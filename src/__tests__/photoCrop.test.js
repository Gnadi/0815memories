import { describe, it, expect } from 'vitest'
import { containScale, effectiveScale, imageLayout, panBy } from '../components/scrapbook/photoCrop'
import { computeCoverRect, drawImageCovered } from '../utils/collageRenderer'

describe('containScale', () => {
  it('zooms a portrait photo out until it fits a landscape frame', () => {
    // 600 × 800 photo in a 720 × 450 frame: height decides, 450/800 of it.
    const scale = containScale(600, 800, 720, 450)
    const { sw, sh } = computeCoverRect(600, 800, 720, 450, scale)
    expect(sh).toBeCloseTo(800)
    expect(sw).toBeGreaterThanOrEqual(600)
  })

  it('is 1 when the photo already has the frame\'s shape', () => {
    expect(containScale(800, 600, 400, 300)).toBeCloseTo(1)
  })
})

describe('effectiveScale', () => {
  it('prefers "whole photo" over a stored zoom', () => {
    expect(effectiveScale({ fit: 'contain', imageScale: 2 }, 600, 800, 720, 450)).toBeCloseTo(containScale(600, 800, 720, 450))
    expect(effectiveScale({ imageScale: 2 }, 600, 800, 720, 450)).toBe(2)
    expect(effectiveScale({}, 600, 800, 720, 450)).toBe(1)
  })
})

describe('imageLayout', () => {
  it('centres the cover crop by default', () => {
    // 1000 × 1000 photo in a 200 × 100 frame: 200 px wide, 50 px cut top and bottom.
    expect(imageLayout(1000, 1000, 200, 100)).toEqual({ left: -0, top: -50, width: 200, height: 200 })
  })

  it('shows the top of the photo when panned all the way up', () => {
    expect(imageLayout(1000, 1000, 200, 100, 1, 0, -1).top).toBeCloseTo(0)
    expect(imageLayout(1000, 1000, 200, 100, 1, 0, 1).top).toBeCloseTo(-100)
  })
})

describe('panBy', () => {
  it('moves the picture with the drag and stops at the edges', () => {
    // Frame 200 × 100 on a square photo: 50 frame-px of room above and below.
    const down = panBy({}, 1000, 1000, 200, 100, 0, 25)
    expect(down.offsetY).toBeCloseTo(-0.5) // dragging down reveals more of the top
    expect(panBy({}, 1000, 1000, 200, 100, 0, 500).offsetY).toBe(-1)
    // No horizontal room: the x offset does not move.
    expect(panBy({}, 1000, 1000, 200, 100, 40, 0).offsetX).toBe(0)
  })

  it('reverses horizontal panning for a mirrored photo', () => {
    const plain = panBy({ imageScale: 2 }, 1000, 1000, 100, 100, 10, 0).offsetX
    const mirrored = panBy({ imageScale: 2, flipped: true }, 1000, 1000, 100, 100, 10, 0).offsetX
    expect(mirrored).toBeCloseTo(-plain)
  })
})

describe('drawImageCovered when zoomed out', () => {
  it('draws the whole photo inside the frame instead of sampling past its edges', () => {
    const calls = []
    const ctx = { drawImage: (...args) => calls.push(args), save() {}, restore() {}, translate() {}, scale() {} }
    const img = { naturalWidth: 600, naturalHeight: 800 }
    drawImageCovered(ctx, img, 720, 450, containScale(600, 800, 720, 450))
    const [, sx, sy, sw, sh, dx, dy, dw, dh] = calls[0]
    expect([sx, sy, sw, sh]).toEqual([0, 0, 600, 800])
    expect(dy).toBeCloseTo(0)
    expect(dh).toBeCloseTo(450)
    expect(dx).toBeCloseTo((720 - dw) / 2)
  })
})
