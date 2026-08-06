import { describe, it, expect, vi } from 'vitest'
import { computeCoverRect, slotRect, drawCollage, drawImageCovered } from '../utils/collageRenderer'
import { getTemplate, makeCollageDoc } from '../components/collage/collageTemplates'

describe('computeCoverRect', () => {
  it('crops the sides of an image wider than the box', () => {
    // 400×200 image into a 100×100 box: keep the full height, crop to 200 wide.
    expect(computeCoverRect(400, 200, 100, 100)).toEqual({ sx: 100, sy: 0, sw: 200, sh: 200 })
  })

  it('crops the top and bottom of an image taller than the box', () => {
    expect(computeCoverRect(200, 400, 100, 100)).toEqual({ sx: 0, sy: 100, sw: 200, sh: 200 })
  })

  it('matches the box aspect ratio, not the image ratio', () => {
    const { sw, sh } = computeCoverRect(1000, 1000, 100, 200)
    expect(sw / sh).toBeCloseTo(0.5, 5)
  })

  it('zooms into the centre', () => {
    // 2× zoom halves the source rect and keeps it centred.
    expect(computeCoverRect(400, 400, 100, 100, 2)).toEqual({ sx: 100, sy: 100, sw: 200, sh: 200 })
  })

  it('pans within the image and never past its edges', () => {
    const right = computeCoverRect(400, 400, 100, 100, 2, 1, 0)
    expect(right.sx).toBe(200)
    expect(right.sx + right.sw).toBe(400)

    const left = computeCoverRect(400, 400, 100, 100, 2, -1, 0)
    expect(left.sx).toBe(0)

    // Beyond ±1 is clamped rather than sampling outside the image.
    expect(computeCoverRect(400, 400, 100, 100, 2, 5, 0).sx).toBe(200)
  })

  it('leaves the scrapbook zoom-out behaviour alone', () => {
    // 0.5× is how the scrapbook editor shows *less* than a full cover crop.
    const { sw } = computeCoverRect(400, 400, 100, 100, 0.5)
    expect(sw).toBe(800)
  })

  it('returns an empty rect for degenerate input', () => {
    expect(computeCoverRect(0, 0, 100, 100)).toEqual({ sx: 0, sy: 0, sw: 0, sh: 0 })
    expect(computeCoverRect(100, 100, 0, 100)).toEqual({ sx: 0, sy: 0, sw: 0, sh: 0 })
  })
})

describe('slotRect', () => {
  const slot = { x: 0.25, y: 0.5, w: 0.5, h: 0.25 }

  it('turns fractions into pixels', () => {
    expect(slotRect(slot, 800, 1000)).toMatchObject({ x: 200, y: 500, w: 400, h: 250 })
  })

  it('scales linearly, so a thumbnail and an export agree', () => {
    const small = slotRect(slot, 200, 250)
    const large = slotRect(slot, 1600, 2000)
    expect(large.x / small.x).toBeCloseTo(8, 5)
    expect(large.w / small.w).toBeCloseTo(8, 5)
    expect(large.h / small.h).toBeCloseTo(8, 5)
  })

  it('insets both edges by the gap', () => {
    // gap 0.01 of an 800px canvas = 8px total, 4px per edge.
    const rect = slotRect(slot, 800, 1000, 0.01)
    expect(rect.x).toBe(204)
    expect(rect.w).toBe(392)
  })

  it('reports the centre, which is what the renderer rotates around', () => {
    const rect = slotRect(slot, 800, 1000)
    expect(rect.cx).toBe(rect.x + rect.w / 2)
    expect(rect.cy).toBe(rect.y + rect.h / 2)
  })
})

// A recording 2D context: enough of the API for the renderer, and a log of the
// calls so the test can assert what was drawn without pixel comparison.
function fakeContext() {
  const calls = []
  const record = (name) => (...args) => calls.push([name, ...args])
  return {
    calls,
    fillStyle: null,
    strokeStyle: null,
    lineWidth: 0,
    globalAlpha: 1,
    clearRect: record('clearRect'),
    fillRect: record('fillRect'),
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    rect: record('rect'),
    ellipse: record('ellipse'),
    roundRect: record('roundRect'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    quadraticCurveTo: record('quadraticCurveTo'),
    clip: record('clip'),
    stroke: record('stroke'),
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    rotate: record('rotate'),
    scale: record('scale'),
    drawImage: record('drawImage'),
  }
}

const fakeImage = (width = 400, height = 400) => ({ naturalWidth: width, naturalHeight: height })

describe('drawCollage', () => {
  it('fills the background before drawing any slot', () => {
    const ctx = fakeContext()
    const doc = makeCollageDoc(getTemplate('four-grid'))
    drawCollage(ctx, doc, new Map(), { width: 400, height: 400 })

    const names = ctx.calls.map(([name]) => name)
    expect(names[0]).toBe('clearRect')
    expect(names[1]).toBe('fillRect')
  })

  it('draws one image per filled slot and skips the empty ones', () => {
    const ctx = fakeContext()
    const doc = makeCollageDoc(getTemplate('four-grid'))
    doc.slots[0].url = 'a.jpg'
    doc.slots[2].url = 'b.jpg'
    const images = new Map([['a.jpg', fakeImage()], ['b.jpg', fakeImage()]])

    drawCollage(ctx, doc, images, { width: 400, height: 400 })

    expect(ctx.calls.filter(([name]) => name === 'drawImage')).toHaveLength(2)
  })

  it('clips a circular slot with an ellipse and a rounded one with a rounded rect', () => {
    const circle = fakeContext()
    drawCollage(circle, makeCollageDoc(getTemplate('circle-center')), new Map(), { width: 400, height: 400 })
    expect(circle.calls.some(([name]) => name === 'ellipse')).toBe(true)

    const rounded = fakeContext()
    drawCollage(rounded, makeCollageDoc(getTemplate('four-grid')), new Map(), { width: 400, height: 400 })
    expect(rounded.calls.some(([name]) => name === 'roundRect')).toBe(true)
  })

  it('rotates the slots a tilted template asks for', () => {
    const ctx = fakeContext()
    drawCollage(ctx, makeCollageDoc(getTemplate('polaroid-scatter')), new Map(), { width: 400, height: 500 })
    expect(ctx.calls.filter(([name]) => name === 'rotate').length).toBeGreaterThan(0)
  })

  it('only strokes a border when one is set', () => {
    const doc = makeCollageDoc(getTemplate('four-grid'))

    const none = fakeContext()
    drawCollage(none, doc, new Map(), { width: 400, height: 400 })
    expect(none.calls.some(([name]) => name === 'stroke')).toBe(false)

    const framed = fakeContext()
    drawCollage(framed, { ...doc, border: { ...doc.border, width: 0.02 } }, new Map(), { width: 400, height: 400 })
    expect(framed.calls.filter(([name]) => name === 'stroke')).toHaveLength(doc.slots.length)
  })

  it('paints placeholders only when asked (preview, never export)', () => {
    const preview = fakeContext()
    drawCollage(preview, makeCollageDoc(getTemplate('four-grid')), new Map(), {
      width: 400, height: 400, placeholders: true,
    })
    // One background fill plus one per empty slot.
    expect(preview.calls.filter(([name]) => name === 'fillRect')).toHaveLength(5)

    const exported = fakeContext()
    drawCollage(exported, makeCollageDoc(getTemplate('four-grid')), new Map(), { width: 400, height: 400 })
    expect(exported.calls.filter(([name]) => name === 'fillRect')).toHaveLength(1)
  })

  it('survives a photo whose image failed to decrypt', () => {
    const ctx = fakeContext()
    const doc = makeCollageDoc(getTemplate('four-grid'))
    doc.slots[0].url = 'missing.jpg'
    expect(() => drawCollage(ctx, doc, new Map(), { width: 400, height: 400 })).not.toThrow()
    expect(ctx.calls.some(([name]) => name === 'drawImage')).toBe(false)
  })
})

describe('drawImageCovered', () => {
  it('mirrors a flipped photo instead of moving it', () => {
    const ctx = fakeContext()
    drawImageCovered(ctx, fakeImage(200, 200), 100, 100, 1, true)
    const names = ctx.calls.map(([name]) => name)
    expect(names).toContain('scale')
    expect(ctx.calls.find(([name]) => name === 'scale')).toEqual(['scale', -1, 1])
  })

  it('does nothing for an image with no intrinsic size', () => {
    const ctx = fakeContext()
    drawImageCovered(ctx, { naturalWidth: 0, naturalHeight: 0 }, 100, 100)
    expect(ctx.calls).toHaveLength(0)
  })
})

describe('loadSlotImages', () => {
  it('skips a photo that cannot be decrypted rather than failing the collage', async () => {
    vi.resetModules()
    vi.doMock('../components/media/useDecryptedMedia', () => ({
      prefetchDecryptedMedia: vi.fn(async (url) => (url === 'bad.jpg' ? null : `blob:${url}`)),
    }))
    // Image() resolves for anything but the URL we mark as broken.
    class FakeImage {
      set src(value) {
        if (value.includes('broken')) setTimeout(() => this.onerror?.(), 0)
        else setTimeout(() => this.onload?.(), 0)
      }
    }
    vi.stubGlobal('Image', FakeImage)

    const { loadSlotImages } = await import('../utils/collageRenderer')
    const images = await loadSlotImages({
      slots: [{ url: 'good.jpg' }, { url: 'broken.jpg' }, { url: null }],
    }, 'key')

    expect(images.has('good.jpg')).toBe(true)
    expect(images.has('broken.jpg')).toBe(false)
    expect(images.size).toBe(1)

    vi.unstubAllGlobals()
    vi.doUnmock('../components/media/useDecryptedMedia')
    vi.resetModules()
  })
})
