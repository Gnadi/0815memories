import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// jsdom decodes and draws nothing, so the decode, the canvas and the encoder
// are stand-ins: each test says how large the photo is and what each quality
// step encodes to.
const fake = vi.hoisted(() => ({
  bitmap: null,
  encoded: [],
  canvases: [],
  encodeCalls: [],
}))

vi.mock('../utils/imageThumbnail', () => ({
  decodeImage: vi.fn(async () => fake.bitmap),
  encodeCanvas: vi.fn(async (canvas, type, quality) => {
    fake.encodeCalls.push({ type, quality })
    const next = fake.encoded.shift()
    if (!next) return null
    const blob = new Blob(['x'], { type: next.type ?? type })
    Object.defineProperty(blob, 'size', { value: next.size })
    return blob
  }),
}))

import { fitImageToLimit, MAX_PHOTO_EDGE } from '../utils/imageCompression'
import { decodeImage } from '../utils/imageThumbnail'
import { MAX_PLAINTEXT_BYTES } from '../constants/media'

const MB = 1024 * 1024

function photo(size, type = 'image/jpeg') {
  const blob = new Blob(['x'], { type })
  Object.defineProperty(blob, 'size', { value: size })
  return blob
}

function bitmap(width, height) {
  return { width, height, close: vi.fn() }
}

beforeEach(() => {
  fake.bitmap = bitmap(8064, 6048)
  fake.encoded = []
  fake.canvases = []
  fake.encodeCalls = []
  decodeImage.mockClear()
  vi.stubGlobal('OffscreenCanvas', class {
    constructor(width, height) {
      this.width = width
      this.height = height
      this.drawn = null
      fake.canvases.push(this)
    }
    getContext() {
      return { drawImage: (_bitmap, x, y, w, h) => { this.drawn = { w, h } } }
    }
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fitImageToLimit', () => {
  it('leaves files that are not photos alone', async () => {
    const memo = photo(20 * MB, 'audio/webm')
    expect(await fitImageToLimit(memo)).toBe(memo)
    expect(decodeImage).not.toHaveBeenCalled()
  })

  it('does not even decode a small photo', async () => {
    const small = photo(2 * MB)
    expect(await fitImageToLimit(small)).toBe(small)
    expect(decodeImage).not.toHaveBeenCalled()
  })

  it('keeps a 12 MP photo as it was picked', async () => {
    // The archive keeps originals; most phones take photos this size.
    fake.bitmap = bitmap(4032, 3024)
    const original = photo(5 * MB)
    expect(await fitImageToLimit(original)).toBe(original)
    expect(fake.encodeCalls).toHaveLength(0)
  })

  it('scales a 48 MP photo down to 4096 px on its long side, as a JPEG', async () => {
    fake.encoded = [{ size: 2 * MB }]
    const original = photo(18 * MB)

    const result = await fitImageToLimit(original)

    expect(result.size).toBe(2 * MB)
    expect(result.type).toBe('image/jpeg')
    expect(fake.canvases[0]).toMatchObject({ width: MAX_PHOTO_EDGE, height: 3072 })
    expect(fake.canvases[0].drawn).toEqual({ w: 4096, h: 3072 })
    expect(fake.encodeCalls).toEqual([{ type: 'image/jpeg', quality: 0.9 }])
    expect(fake.bitmap.close).toHaveBeenCalled()
  })

  it('scales portrait photos by their height', async () => {
    fake.bitmap = bitmap(6048, 8064)
    fake.encoded = [{ size: 2 * MB }]
    await fitImageToLimit(photo(18 * MB))
    expect(fake.canvases[0]).toMatchObject({ width: 3072, height: 4096 })
  })

  it('scales a large photo down even when it is under the size limit', async () => {
    fake.encoded = [{ size: 2 * MB }]
    const result = await fitImageToLimit(photo(8 * MB))
    expect(result.size).toBe(2 * MB)
  })

  it('keeps the original when the scaled copy is no smaller and the original fits', async () => {
    fake.encoded = [{ size: 9 * MB }]
    const original = photo(8 * MB)
    expect(await fitImageToLimit(original)).toBe(original)
  })

  it('lowers the quality only for a photo that would otherwise be refused', async () => {
    fake.bitmap = bitmap(4000, 3000)
    fake.encoded = [{ size: MAX_PLAINTEXT_BYTES + 1 }, { size: 9 * MB }]

    const result = await fitImageToLimit(photo(14 * MB))

    expect(result.size).toBe(9 * MB)
    expect(fake.encodeCalls.map((c) => c.quality)).toEqual([0.9, 0.82])
    // Already under 4096 px, so drawn at its own size.
    expect(fake.canvases[0]).toMatchObject({ width: 4000, height: 3000 })
  })

  it('hands the original back when nothing fits, for the upload to refuse', async () => {
    fake.encoded = [
      { size: MAX_PLAINTEXT_BYTES + 3 },
      { size: MAX_PLAINTEXT_BYTES + 2 },
      { size: MAX_PLAINTEXT_BYTES + 1 },
    ]
    const original = photo(30 * MB)
    expect(await fitImageToLimit(original)).toBe(original)
    expect(fake.encodeCalls).toHaveLength(3)
  })

  it('keeps the transparency of a PNG by making it a WebP', async () => {
    fake.encoded = [{ size: 3 * MB }]
    const result = await fitImageToLimit(photo(20 * MB, 'image/png'))
    expect(result.type).toBe('image/webp')
  })

  it('stops after one try when the browser answers WebP with a PNG', async () => {
    // Safari cannot encode WebP; the quality steps would only repeat the PNG.
    fake.encoded = [{ size: MAX_PLAINTEXT_BYTES + 1, type: 'image/png' }]
    const original = photo(20 * MB, 'image/png')
    expect(await fitImageToLimit(original)).toBe(original)
    expect(fake.encodeCalls).toHaveLength(1)
  })

  it('never flattens an animated GIF', async () => {
    const gif = photo(12 * MB, 'image/gif')
    expect(await fitImageToLimit(gif)).toBe(gif)
    expect(decodeImage).not.toHaveBeenCalled()
  })

  it('hands back a photo this browser cannot decode, such as HEIC outside Safari', async () => {
    fake.bitmap = null
    const heic = photo(14 * MB, 'image/heic')
    expect(await fitImageToLimit(heic)).toBe(heic)
  })
})
