import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createThumbnail, createVideoPoster, THUMBNAIL_MAX_EDGE } from '../utils/imageThumbnail'

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

// A clip is stored encrypted, so the frame that stands for it in the story
// circle has to be taken in the browser that uploads it.
describe('createVideoPoster', () => {
  const restores = []
  const stub = (proto, key, descriptor) => {
    const original = Object.getOwnPropertyDescriptor(proto, key)
    Object.defineProperty(proto, key, { configurable: true, ...descriptor })
    restores.push(() => {
      if (original) Object.defineProperty(proto, key, original)
      else delete proto[key]
    })
  }
  const clip = () => new Blob([new Uint8Array(1024)], { type: 'video/mp4' })

  beforeEach(() => {
    // Stubbed even where the environment has one: Vitest 4 wraps jsdom's and
    // reads jsdom internals that jsdom 31 no longer has, and the test needs
    // no real blob URL.
    stub(URL, 'createObjectURL', { value: () => 'blob:clip', writable: true })
    stub(URL, 'revokeObjectURL', { value: () => {}, writable: true })
    // jsdom has no media loading, and says so on every clean-up.
    stub(HTMLMediaElement.prototype, 'load', { value() {} })
  })
  afterEach(() => {
    while (restores.length) restores.pop()()
  })

  it('takes a frame from early in the clip, at most the thumbnail size', async () => {
    const drawn = []
    let seekedTo = null
    stub(HTMLMediaElement.prototype, 'src', { set() { queueMicrotask(() => this.onloadedmetadata?.()) } })
    stub(HTMLMediaElement.prototype, 'duration', { get: () => 13 })
    stub(HTMLMediaElement.prototype, 'currentTime', {
      set(value) { seekedTo = value; queueMicrotask(() => this.onseeked?.()) },
    })
    stub(HTMLVideoElement.prototype, 'videoWidth', { get: () => 1920 })
    stub(HTMLVideoElement.prototype, 'videoHeight', { get: () => 1080 })
    stub(HTMLCanvasElement.prototype, 'getContext', {
      value() {
        const canvas = this
        return { drawImage: (_v, _x, _y, w, h) => drawn.push([w, h, canvas.width, canvas.height]) }
      },
    })
    stub(HTMLCanvasElement.prototype, 'toBlob', {
      value(callback, type) { callback(new Blob(['frame'], { type })) },
    })

    const poster = await createVideoPoster(clip())

    expect(poster.type).toBe('image/webp')
    expect(seekedTo).toBe(0.5)
    expect(drawn).toEqual([[THUMBNAIL_MAX_EDGE, 576, THUMBNAIL_MAX_EDGE, 576]])
  })

  it('returns null when the browser cannot read the clip', async () => {
    stub(HTMLMediaElement.prototype, 'src', { set() { queueMicrotask(() => this.onerror?.()) } })
    expect(await createVideoPoster(clip())).toBeNull()
  })

  it.each([
    ['a photo', new Blob(['x'], { type: 'image/jpeg' })],
    ['nothing', null],
  ])('returns null for %s', async (_label, input) => {
    expect(await createVideoPoster(input)).toBeNull()
  })
})
