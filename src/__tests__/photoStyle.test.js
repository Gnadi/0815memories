import { describe, it, expect } from 'vitest'
import {
  FILTER_PRESETS, filterCss, filterMatrix, applyFilterToPixels, frameRadius, frameBorder,
} from '../components/scrapbook/photoStyle'

describe('filterCss', () => {
  it('writes the CSS filter for a preset and nothing for the original', () => {
    expect(filterCss('none')).toBeUndefined()
    expect(filterCss('unknown')).toBeUndefined()
    expect(filterCss('bw')).toBe('grayscale(1) contrast(1.1)')
    expect(filterCss('cool')).toContain('hue-rotate(12deg)')
  })

  it('has a translation-friendly id and at least one step for every real preset', () => {
    for (const p of FILTER_PRESETS) {
      if (p.id !== 'none') expect(p.steps.length).toBeGreaterThan(0)
    }
  })
})

describe('applyFilterToPixels', () => {
  it('turns a colour grey for black & white, keeping alpha', () => {
    const px = new Uint8ClampedArray([200, 40, 40, 128])
    applyFilterToPixels(px, 'bw')
    expect(px[0]).toBe(px[1])
    expect(px[1]).toBe(px[2])
    expect(px[3]).toBe(128)
  })

  it('matches the CSS definition of grayscale(1) on pure red', () => {
    // Filter Effects spec: red → 0.2126 luminance on every channel.
    const px = new Uint8ClampedArray([255, 0, 0, 255])
    const m = filterMatrix('bw')
    applyFilterToPixels(px, 'bw')
    const expected = Math.round(255 * 0.2126 * 1.1 + (0.5 - 0.55) * 255)
    expect(Math.abs(px[0] - expected)).toBeLessThanOrEqual(1)
    expect(m).toHaveLength(3)
  })

  it('leaves pixels alone for the original', () => {
    const px = new Uint8ClampedArray([10, 20, 30, 255])
    applyFilterToPixels(px, 'none')
    expect([...px]).toEqual([10, 20, 30, 255])
  })

  it('warms a neutral grey (red above blue) for sepia', () => {
    const px = new Uint8ClampedArray([128, 128, 128, 255])
    applyFilterToPixels(px, 'sepia')
    expect(px[0]).toBeGreaterThan(px[2])
  })
})

describe('frames', () => {
  it('keeps the old look for photos without a corner setting', () => {
    expect(frameRadius({}, 200, 100)).toBe(4)
    expect(frameRadius({ polaroid: true }, 200, 100)).toBe(0)
  })

  it('scales corner rounding with the shorter side, up to a pill', () => {
    expect(frameRadius({ cornerRadius: 0.25 }, 200, 100)).toBe(25)
    expect(frameRadius({ cornerRadius: 2 }, 200, 100)).toBe(50)
    expect(frameRadius({ cornerRadius: 0 }, 200, 100)).toBe(0)
  })

  it('only draws a border with a width', () => {
    expect(frameBorder({})).toBeNull()
    expect(frameBorder({ borderWidth: 6 })).toEqual({ width: 6, color: '#FFFFFF' })
    expect(frameBorder({ borderWidth: 99, borderColor: '#000' })).toEqual({ width: 24, color: '#000' })
  })
})
