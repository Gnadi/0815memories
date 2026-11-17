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
// Signing is covered by uploadSignature.test.js; here every fetch is an upload.
vi.mock('../utils/uploadSignature', () => ({
  fetchUploadSignature: vi.fn(async () => ({
    apiKey: 'k', signature: 'sig', resourceType: 'raw', publicId: 'kaydo/fam/abc',
    params: { overwrite: 'false', public_id: 'kaydo/fam/abc', tags: 'family:fam', timestamp: 1 },
  })),
  signedUploadUrl: () => 'https://api.cloudinary.com/v1_1/demo/raw/upload',
  signedUploadForm: () => new FormData(),
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

  globalThis.fetch = vi.fn(async () => {
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
    globalThis.fetch = vi.fn(async () => {
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
    globalThis.fetch = vi.fn(async () => {
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

  it('makes and uploads the thumbnail without waiting for the original', async () => {
    // Nothing is kept until the form is saved, and the form waits for both, so
    // doing them one after the other only added the thumbnail's time.
    let releaseOriginal
    const originalHeld = new Promise((resolve) => { releaseOriginal = resolve })
    createThumbnail.mockResolvedValue(new Blob(['thumb'], { type: 'image/webp' }))
    const originalFetch = globalThis.fetch
    let uploads = 0
    globalThis.fetch = vi.fn(async (url, init) => {
      if (++uploads === 1) await originalHeld
      return originalFetch(url, init)
    })

    const done = encryptAndUploadWithThumb(file(), { fake: 'key' })
    await vi.waitFor(() => expect(uploads).toBe(2))
    releaseOriginal()

    const result = await done
    expect(result.url).toBeTruthy()
    expect(result.thumbUrl).toBeTruthy()
  })

  it('fails when the original fails, whatever became of the thumbnail', async () => {
    createThumbnail.mockResolvedValue(new Blob(['thumb'], { type: 'image/webp' }))
    globalThis.fetch = vi.fn(async () => {
      const n = ++uploadCount
      // The original asks first, so it is the first upload.
      if (n === 1) {
        return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) }
      }
      return { ok: true, json: async () => ({ secure_url: `https://cdn/asset-${n}.enc`, public_id: `pub-${n}` }) }
    })

    await expect(encryptAndUploadWithThumb(file(), { fake: 'key' })).rejects.toThrow('Upload failed (500)')
  })
})
