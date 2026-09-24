/* The story viewer "blinked" on large photos: a moment would go dark for an
   instant while it was being looked at. The viewer showed the full original —
   12 to 50 megapixels, 50 to 200 MB once decoded, for a screen of about three —
   and a phone's browser cannot always keep a bitmap that size ready to paint.

   displayCopy downscales the original to the frame it fills and keeps the copy
   in the decrypted-media cache. These run the real cache, with the fetch, the
   decrypt and the canvas work stubbed. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../utils/encryption', () => ({ decryptBlob: vi.fn() }))
vi.mock('../utils/devLog', () => ({ devError: vi.fn(), devWarn: vi.fn() }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ encryptionKey: KEY, keyLoading: false }) }))
const KEY = { fake: 'key' }

const h = vi.hoisted(() => ({ plaintext: new Map(), createThumbnail: null }))
vi.mock('../utils/decryptPool', () => ({
  decryptBlobOffThread: vi.fn(async (_key, buffer) => h.plaintext.get(buffer.url)),
}))
vi.mock('../utils/imageThumbnail', () => ({
  createThumbnail: (...args) => h.createThumbnail(...args),
}))

import {
  prefetchDecryptedMedia,
  peekDecryptedMedia,
  clearDecryptedMediaCache,
} from '../components/media/useDecryptedMedia'
import { coverEdge, displayCopyKey, fitForDisplay } from '../components/media/displayCopy'

const PHONE = { width: 1280, height: 2560 }
// JPEG magic bytes, so the cache's sniffing keeps the type.
const jpeg = (size) => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), new Uint8Array(size)], { type: 'image/jpeg' })
const gif = () => new Blob([new Uint8Array([0x47, 0x49, 0x46, 0x38]), new Uint8Array(64)], { type: 'image/gif' })

let urls
beforeEach(() => {
  clearDecryptedMediaCache()
  h.plaintext.clear()
  urls = 0
  URL.createObjectURL = vi.fn(() => `blob:${++urls}`)
  URL.revokeObjectURL = vi.fn()
  globalThis.fetch = vi.fn(async (url) => ({
    ok: true,
    arrayBuffer: async () => Object.assign(new ArrayBuffer(8), { url }),
  }))
  h.createThumbnail = vi.fn(async () => jpeg(1000))
})
afterEach(() => clearDecryptedMediaCache())

async function decrypted(src, blob) {
  h.plaintext.set(src, blob)
  await prefetchDecryptedMedia(src, KEY, 'image/*')
}

describe('coverEdge', () => {
  it('is the longest edge a photo needs to cover the frame, object-cover style', () => {
    // A 12 MP portrait photo on a phone: the height has to reach 2560.
    expect(coverEdge(3024, 4032, PHONE)).toBe(2560)
    // A 50 MP landscape photo on the same phone: scaled until its height
    // reaches 2560, and the width that makes is what is needed.
    expect(coverEdge(8160, 6120, PHONE)).toBe(3414)
  })

  it('never asks for more than a phone can hold as one texture', () => {
    // A panorama: covering the frame's height would make it 12 000 px wide.
    expect(coverEdge(16000, 3400, PHONE)).toBe(4096)
  })
})

describe('fitForDisplay', () => {
  it('shows a large original as a copy sized to its frame, kept in the media cache', async () => {
    await decrypted('https://cdn/a.enc', jpeg(5_000_000))

    const key = await fitForDisplay('https://cdn/a.enc', PHONE)

    expect(key).toBe('https://cdn/a.enc#display=1280x2560')
    expect(peekDecryptedMedia(key)).toMatch(/^blob:/)
    expect(displayCopyKey('https://cdn/a.enc')).toBe(key)
    const [, options] = h.createThumbnail.mock.calls[0]
    expect(options.type).toBe('image/jpeg')
    expect(options.maxEdge(3024, 4032)).toBe(2560)
  })

  it('makes each copy once, however many ask at the same time', async () => {
    await decrypted('https://cdn/a.enc', jpeg(5_000_000))
    const [one, two] = await Promise.all([
      fitForDisplay('https://cdn/a.enc', PHONE),
      fitForDisplay('https://cdn/a.enc', PHONE),
    ])
    expect(one).toBe(two)
    expect(h.createThumbnail).toHaveBeenCalledTimes(1)

    // …and a later visit finds it in the cache.
    await fitForDisplay('https://cdn/a.enc', PHONE)
    expect(h.createThumbnail).toHaveBeenCalledTimes(1)
  })

  it('shows the original itself when a copy would not help', async () => {
    // Already no larger than the frame, or not something the canvas can redraw.
    h.createThumbnail = vi.fn(async () => null)
    await decrypted('https://cdn/small.enc', jpeg(200_000))
    expect(await fitForDisplay('https://cdn/small.enc', PHONE)).toBe('https://cdn/small.enc')
    expect(displayCopyKey('https://cdn/small.enc')).toBe('https://cdn/small.enc')
  })

  it('leaves an animated GIF alone — a redraw would keep only its first frame', async () => {
    await decrypted('https://cdn/anim.enc', gif())
    expect(await fitForDisplay('https://cdn/anim.enc', PHONE)).toBe('https://cdn/anim.enc')
    expect(h.createThumbnail).not.toHaveBeenCalled()
  })

  it('has nothing to do for an original that is not decrypted', async () => {
    expect(await fitForDisplay('https://cdn/never.enc', PHONE)).toBeNull()
  })

  it('goes with the rest of the plaintext on logout', async () => {
    await decrypted('https://cdn/a.enc', jpeg(5_000_000))
    const key = await fitForDisplay('https://cdn/a.enc', PHONE)
    const url = peekDecryptedMedia(key)

    clearDecryptedMediaCache()
    expect(peekDecryptedMedia(key)).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url)
  })
})
