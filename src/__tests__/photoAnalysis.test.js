import { describe, it, expect } from 'vitest'
import { measurePixels, summariseFaces } from '../utils/photoAnalysis'

// An RGBA image filled by `pixel(x, y) → [r, g, b]`.
function image(width, height, pixel) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y)
      data.set([r, g, b, 255], (y * width + x) * 4)
    }
  }
  return data
}

describe('measurePixels', () => {
  it('finds nothing sharp or colourful in a flat grey', () => {
    const m = measurePixels(image(32, 32, () => [128, 128, 128]), 32, 32)
    expect(m.brightness).toBeCloseTo(0.5, 2)
    expect(m.colorfulness).toBe(0)
    expect(m.sharpness).toBe(0)
  })

  it('finds a fine pattern sharper than a soft gradient', () => {
    const fine = measurePixels(image(32, 32, (x, y) => ((x + y) % 2 ? [255, 255, 255] : [0, 0, 0])), 32, 32)
    const soft = measurePixels(image(32, 32, (x) => [x * 8, x * 8, x * 8]), 32, 32)
    expect(fine.sharpness).toBeGreaterThan(0.9)
    expect(soft.sharpness).toBeLessThan(0.05)
  })

  it('finds red and blue more colourful than grey, and black dark', () => {
    const colourful = measurePixels(image(16, 16, (x) => (x < 8 ? [230, 20, 20] : [20, 20, 230])), 16, 16)
    expect(colourful.colorfulness).toBeGreaterThan(0.8)
    expect(measurePixels(image(4, 4, () => [0, 0, 0]), 4, 4).brightness).toBe(0)
  })

  it('survives an empty image', () => {
    expect(measurePixels(new Uint8ClampedArray(0), 0, 0)).toEqual({ brightness: 0, colorfulness: 0, sharpness: 0 })
  })
})

describe('summariseFaces', () => {
  // A face as the landmarker reports it: points across `width` of the photo.
  const face = (left, width) => [{ x: left, y: 0.4 }, { x: left + width, y: 0.6 }]
  const shapes = (left, right) => ({
    categories: [
      { categoryName: 'mouthSmileLeft', score: left },
      { categoryName: 'mouthSmileRight', score: right },
      { categoryName: 'jawOpen', score: 0.9 },
    ],
  })

  it('counts the faces and keeps the widest smile', () => {
    const result = {
      faceLandmarks: [face(0.1, 0.2), face(0.5, 0.2)],
      faceBlendshapes: [shapes(0.2, 0.4), shapes(0.9, 0.8)],
    }
    expect(summariseFaces(result)).toEqual({ faces: 2, smile: 0.85 })
  })

  it('leaves out faces far in the background', () => {
    const result = {
      faceLandmarks: [face(0.1, 0.02), face(0.5, 0.3)],
      faceBlendshapes: [shapes(1, 1), shapes(0.1, 0.1)],
    }
    expect(summariseFaces(result)).toEqual({ faces: 1, smile: 0.1 })
  })

  it('reads no faces as no smile', () => {
    expect(summariseFaces({ faceLandmarks: [], faceBlendshapes: [] })).toEqual({ faces: 0, smile: 0 })
    expect(summariseFaces(undefined)).toEqual({ faces: 0, smile: 0 })
  })
})
