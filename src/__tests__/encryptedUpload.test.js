import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../utils/encryption', () => ({
  encryptBlob: vi.fn(async () => new ArrayBuffer(8)),
  encryptText: vi.fn(async (_key, text) => `encrypted:${text}`),
}))
vi.mock('../utils/imageThumbnail', () => ({
  createThumbnail: vi.fn(),
  // The blur-up preview is encrypted onto the document rather than uploaded, so
  // it must never add to the upload count asserted below.
  createTinyPreview: vi.fn(async () => 'data:image/webp;base64,AAA'),
}))
vi.mock('../config/cloudinary', () => ({
  CLOUDINARY_CLOUD_NAME: 'demo',
}))

import { createThumbnail } from '../utils/imageThumbnail'
import { encryptBlob } from '../utils/encryption'
import { encryptAndUpload, encryptAndUploadWithThumb, UPLOAD_TOO_LARGE } from '../utils/encryptedUpload'
import { MAX_PLAINTEXT_BYTES } from '../constants/media'

let uploadCount

beforeEach(() => {
  uploadCount = 0
  createThumbnail.mockReset()
  encryptBlob.mockClear()

  globalThis.fetch = vi.fn(async (url) => {
    if (typeof url === 'string' && url.startsWith('/api/cloudinary-sign')) {
      return {
        ok: true,
        json: async () => ({ timestamp: 1, signature: 'sig', folder: 'kaydo/encrypted', apiKey: 'k' }),
      }
    }
    uploadCount++
    const n = uploadCount
    return {
      ok: true,
      json: async () => ({ secure_url: `https://cdn/asset-${n}.enc`, public_id: `pub-${n}` }),
    }
  })
})

afterEach(() => {
  delete globalThis.fetch
})

function file(size = 4 * 1024 * 1024) {
  const blob = new Blob(['x'], { type: 'image/jpeg' })
  Object.defineProperty(blob, 'size', { value: size })
  return blob
}

describe('encryptAndUpload', () => {
  it('uploads a single encrypted raw asset', async () => {
    const result = await encryptAndUpload(file(), { fake: 'key' })
    expect(result).toEqual({ url: 'https://cdn/asset-1.enc', publicId: 'pub-1' })
    expect(uploadCount).toBe(1)
  })

  it('refuses an oversized file before encrypting or uploading it', async () => {
    // Encrypting first would pull the whole clip into memory three times over
    // just to have Cloudinary answer 400.
    const err = await encryptAndUpload(file(MAX_PLAINTEXT_BYTES + 1), { fake: 'key' })
      .then(() => null, (e) => e)

    expect(err?.code).toBe(UPLOAD_TOO_LARGE)
    expect(err.size).toBe(MAX_PLAINTEXT_BYTES + 1)
    expect(err.limit).toBe(MAX_PLAINTEXT_BYTES)
    expect(encryptBlob).not.toHaveBeenCalled()
    expect(uploadCount).toBe(0)
  })

  it('tags a Cloudinary size rejection so callers can explain it', async () => {
    globalThis.fetch = vi.fn(async (url) => {
      if (typeof url === 'string' && url.startsWith('/api/cloudinary-sign')) {
        return {
          ok: true,
          json: async () => ({ timestamp: 1, signature: 'sig', folder: 'kaydo/encrypted', apiKey: 'k' }),
        }
      }
      return {
        ok: false,
        status: 400,
        headers: { get: () => null },
        json: async () => ({ error: { message: 'File size too large. Got 24000000. Maximum is 10485760.' } }),
      }
    })

    const err = await encryptAndUpload(file(1024), { fake: 'key' }).then(() => null, (e) => e)
    expect(err?.code).toBe(UPLOAD_TOO_LARGE)
  })

  it('falls back to the X-Cld-Error header when the body carries no reason', async () => {
    globalThis.fetch = vi.fn(async (url) => {
      if (typeof url === 'string' && url.startsWith('/api/cloudinary-sign')) {
        return {
          ok: true,
          json: async () => ({ timestamp: 1, signature: 'sig', folder: 'kaydo/encrypted', apiKey: 'k' }),
        }
      }
      return {
        ok: false,
        status: 400,
        headers: { get: (h) => (h === 'x-cld-error' ? 'Invalid signature' : null) },
        json: async () => { throw new Error('not json') },
      }
    })

    await expect(encryptAndUpload(file(1024), { fake: 'key' })).rejects.toThrow('Invalid signature')
  })
})

describe('encryptAndUploadWithThumb', () => {
  it('uploads the original and a separately encrypted thumbnail', async () => {
    createThumbnail.mockResolvedValue(new Blob(['thumb'], { type: 'image/webp' }))

    const result = await encryptAndUploadWithThumb(file(), { fake: 'key' })

    expect(uploadCount).toBe(2)
    expect(result).toEqual({
      url: 'https://cdn/asset-1.enc',
      publicId: 'pub-1',
      thumbUrl: 'https://cdn/asset-2.enc',
      thumbPublicId: 'pub-2',
      // Encrypted text on the document; two uploads, not three.
      tinyPreview: 'encrypted:data:image/webp;base64,AAA',
    })
  })

  it('still returns the original when no thumbnail could be produced', async () => {
    createThumbnail.mockResolvedValue(null)

    const result = await encryptAndUploadWithThumb(file(), { fake: 'key' })

    expect(uploadCount).toBe(1)
    expect(result.url).toBe('https://cdn/asset-1.enc')
    expect(result.thumbUrl).toBe('')
  })

  it('never fails the upload because the thumbnail failed', async () => {
    createThumbnail.mockRejectedValue(new Error('canvas is tainted'))

    const result = await encryptAndUploadWithThumb(file(), { fake: 'key' })

    expect(result.url).toBe('https://cdn/asset-1.enc')
    expect(result.thumbUrl).toBe('')
  })

  it('uploads the original before attempting the thumbnail', async () => {
    // Ordering matters: the original must be safely stored even if the tab is
    // closed while the derivative is still encoding.
    const order = []
    createThumbnail.mockImplementation(async () => {
      order.push('thumbnail')
      return new Blob(['thumb'], { type: 'image/webp' })
    })
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async (url, init) => {
      if (init?.method === 'POST') order.push('upload')
      return originalFetch(url, init)
    })

    await encryptAndUploadWithThumb(file(), { fake: 'key' })
    expect(order).toEqual(['upload', 'thumbnail', 'upload'])
  })
})
