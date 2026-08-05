import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createThumbnail, THUMBNAIL_MAX_EDGE } from '../utils/imageThumbnail'

// A blob big enough to clear the "not worth downscaling" size floor.
function imageBlob(bytes = 4 * 1024 * 1024, type = 'image/jpeg') {
  const blob = new Blob(['x'], { type })
  Object.defineProperty(blob, 'size', { value: bytes })
  return blob
}

let drawn

function installCanvasStubs({ encodedSize = 40 * 1024 } = {}) {
  drawn = null
  globalThis.OffscreenCanvas = class {
    constructor(width, height) {
      this.width = width
      this.height = height
    }
    getContext() {
      return {
        drawImage: (_bitmap, _x, _y, w, h) => {
          drawn = { width: w, height: h }
        },
      }
    }
    convertToBlob({ type }) {
      const blob = new Blob(['thumb'], { type })
      Object.defineProperty(blob, 'size', { value: encodedSize })
      return Promise.resolve(blob)
    }
  }
}

function stubBitmap(width, height) {
  globalThis.createImageBitmap = vi.fn(async () => ({ width, height, close: vi.fn() }))
}

beforeEach(() => {
  installCanvasStubs()
  stubBitmap(4032, 3024)
})

afterEach(() => {
  delete globalThis.createImageBitmap
  delete globalThis.OffscreenCanvas
})

describe('createThumbnail', () => {
  it('downscales the longest edge to the target and keeps the aspect ratio', async () => {
    const blob = await createThumbnail(imageBlob())

    expect(blob).toBeTruthy()
    expect(blob.type).toBe('image/webp')
    expect(drawn.width).toBe(THUMBNAIL_MAX_EDGE)
    // 4032x3024 is 4:3, so 1024 wide means 768 tall.
    expect(drawn.height).toBe(Math.round((3024 / 4032) * THUMBNAIL_MAX_EDGE))
  })

  it('scales portrait photos by their height', async () => {
    stubBitmap(3024, 4032)
    await createThumbnail(imageBlob())

    expect(drawn.height).toBe(THUMBNAIL_MAX_EDGE)
    expect(drawn.width).toBe(Math.round((3024 / 4032) * THUMBNAIL_MAX_EDGE))
  })

  it('applies the EXIF orientation so phone photos are not sideways', async () => {
    await createThumbnail(imageBlob())
    expect(globalThis.createImageBitmap).toHaveBeenCalledWith(
      expect.anything(),
      { imageOrientation: 'from-image' }
    )
  })

  it('returns null when the image is already smaller than the target', async () => {
    stubBitmap(800, 600)
    expect(await createThumbnail(imageBlob())).toBeNull()
  })

  it('returns null when the re-encode came out no smaller than the original', async () => {
    installCanvasStubs({ encodedSize: 8 * 1024 * 1024 })
    expect(await createThumbnail(imageBlob(4 * 1024 * 1024))).toBeNull()
  })

  it.each([
    ['a small file', imageBlob(10 * 1024)],
    ['a video', imageBlob(4 * 1024 * 1024, 'video/mp4')],
    ['a non-blob', null],
  ])('returns null for %s', async (_label, input) => {
    expect(await createThumbnail(input)).toBeNull()
  })

  it('returns null instead of throwing when the browser cannot decode the image', async () => {
    globalThis.createImageBitmap = vi.fn(async () => {
      throw new Error('unsupported format')
    })
    expect(await createThumbnail(imageBlob())).toBeNull()
  })

  it('returns null when createImageBitmap is unavailable', async () => {
    delete globalThis.createImageBitmap
    expect(await createThumbnail(imageBlob())).toBeNull()
  })
})
