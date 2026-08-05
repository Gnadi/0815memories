import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../utils/encryption', () => ({
  encryptBlob: vi.fn(async () => new ArrayBuffer(8)),
}))
vi.mock('../utils/imageThumbnail', () => ({
  createThumbnail: vi.fn(),
}))
vi.mock('../config/cloudinary', () => ({
  CLOUDINARY_CLOUD_NAME: 'demo',
}))

import { createThumbnail } from '../utils/imageThumbnail'
import { encryptAndUpload, encryptAndUploadWithThumb } from '../utils/encryptedUpload'

let uploadCount

beforeEach(() => {
  uploadCount = 0
  createThumbnail.mockReset()

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
