/**
 * Tests for the renderer's bounded photo cache.
 *
 * The renderer reuses one page canvas so that an eight-megapixel page costs
 * eight megapixels rather than eight per page. That saving is undone if the
 * decoded originals beside it grow without limit — a hundred-page book of 12 MP
 * photos is gigabytes of bitmap — so the cache's ceiling is the thing that
 * decides whether a large book renders at all.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const decoded = []

// The decrypt path and image decoding both belong to the browser. What is being
// tested is how many of their results are held at once.
vi.mock('../components/media/useDecryptedMedia', () => ({
  prefetchDecryptedMedia: vi.fn(async (url) => `blob:${url}`),
}))

beforeEach(() => {
  decoded.length = 0
  // A stand-in Image that resolves immediately and records every decode, so a
  // cache hit is visible as a decode that did not happen.
  globalThis.Image = class {
    set src(value) {
      decoded.push(value)
      queueMicrotask(() => this.onload?.())
    }
    naturalWidth = 3000
    naturalHeight = 2000
  }
})

const { createPrintImageCache, loadImageSizes } = await import('../utils/printRenderer')

describe('createPrintImageCache', () => {
  it('decodes a photo once and serves it again from memory', async () => {
    const cache = createPrintImageCache(null, { maxEntries: 4 })
    await cache.get('enc://a')
    await cache.get('enc://a')
    expect(decoded).toHaveLength(1)
  })

  it('never holds more than its ceiling', async () => {
    const cache = createPrintImageCache(null, { maxEntries: 3 })
    for (const url of ['a', 'b', 'c', 'd', 'e']) await cache.get(`enc://${url}`)
    // Evicted, so asking again decodes again.
    decoded.length = 0
    await cache.get('enc://a')
    expect(decoded).toHaveLength(1)
  })

  it('keeps the recently used and drops the coldest', async () => {
    const cache = createPrintImageCache(null, { maxEntries: 2 })
    await cache.get('enc://a')
    await cache.get('enc://b')
    await cache.get('enc://a') // a is now the most recent, b the coldest
    await cache.get('enc://c') // evicts b

    decoded.length = 0
    await cache.get('enc://a')
    expect(decoded).toHaveLength(0)
    await cache.get('enc://b')
    expect(decoded).toHaveLength(1)
  })

  it('gives up on an undecodable photo once per book, not once per page', async () => {
    globalThis.Image = class {
      set src(value) {
        decoded.push(value)
        queueMicrotask(() => this.onerror?.())
      }
    }
    const cache = createPrintImageCache(null, { maxEntries: 4 })
    expect(await cache.get('enc://broken')).toBeNull()
    expect(await cache.get('enc://broken')).toBeNull()
    expect(decoded).toHaveLength(1)
  })

  it('lets everything go when cleared', async () => {
    const cache = createPrintImageCache(null, { maxEntries: 4 })
    await cache.get('enc://a')
    cache.clear()
    decoded.length = 0
    await cache.get('enc://a')
    expect(decoded).toHaveLength(1)
  })
})

describe('loadImageSizes', () => {
  const pageWith = (...urls) => ({
    elements: urls.map((url, i) => ({ id: `p${i}`, type: 'photo', url, width: 100, height: 100 })),
  })

  it('returns dimensions, not images', async () => {
    // The preflight only ever asks how many of an original's pixels land on the
    // page. Holding the bitmaps to answer that is the largest avoidable thing
    // in memory.
    const { images } = await loadImageSizes([pageWith('enc://a')], null)
    expect(images.get('enc://a')).toEqual({ naturalWidth: 3000, naturalHeight: 2000 })
  })

  it('measures each distinct photo once across the whole book', async () => {
    const { images } = await loadImageSizes(
      [pageWith('enc://a', 'enc://b'), pageWith('enc://a')],
      null
    )
    expect(decoded).toHaveLength(2)
    expect(images.size).toBe(2)
  })

  it('skips unfilled slots', async () => {
    const page = { elements: [{ id: 's', type: 'photo', url: null }] }
    const { images } = await loadImageSizes([page], null)
    expect(images.size).toBe(0)
    expect(decoded).toHaveLength(0)
  })

  it('reports the photos it could not read rather than failing the book', async () => {
    globalThis.Image = class {
      set src(value) {
        decoded.push(value)
        queueMicrotask(() => this.onerror?.())
      }
    }
    const { images, failed } = await loadImageSizes([pageWith('enc://broken')], null)
    expect(images.size).toBe(0)
    expect(failed).toEqual(['enc://broken'])
  })

  it('reports progress so a long decrypt is not a frozen dialog', async () => {
    const seen = []
    await loadImageSizes([pageWith('enc://a', 'enc://b')], null, { onProgress: (p) => seen.push(p) })
    expect(seen).toEqual([
      { phase: 'images', done: 1, total: 2 },
      { phase: 'images', done: 2, total: 2 },
    ])
  })
})
