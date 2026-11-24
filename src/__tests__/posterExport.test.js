/**
 * The size a birth sky poster is printed at — utils/sky/posterExport.js.
 */
import { describe, it, expect } from 'vitest'
import { DEFAULT_POSTER_FORMAT, posterFileBase, posterPrintFormat, posterPrintWidth } from '../utils/sky/posterExport'
import { POSTER_RATIO } from '../utils/sky/skyRenderer'

describe('poster print format', () => {
  it('is A3 unless an ISO size is configured', () => {
    expect(posterPrintFormat({})).toEqual(DEFAULT_POSTER_FORMAT)
    expect(posterPrintFormat({ VITE_PEECHO_POSTER_WIDTH_MM: '420', VITE_PEECHO_POSTER_HEIGHT_MM: '594' })).toEqual({
      widthMm: 420,
      heightMm: 594,
    })
    // 50 × 70 cm would stretch the sky.
    expect(posterPrintFormat({ VITE_PEECHO_POSTER_WIDTH_MM: '500', VITE_PEECHO_POSTER_HEIGHT_MM: '700' })).toEqual(
      DEFAULT_POSTER_FORMAT,
    )
  })

  it('stays inside the canvas a phone can draw', () => {
    for (const format of [{ widthMm: 210, heightMm: 297 }, DEFAULT_POSTER_FORMAT, { widthMm: 420, heightMm: 594 }]) {
      const width = posterPrintWidth(format)
      expect(width * Math.round(width * POSTER_RATIO)).toBeLessThanOrEqual(16_000_000)
    }
    // A4 fits at the full 300 dpi.
    expect(posterPrintWidth({ widthMm: 210, heightMm: 297 })).toBe(2480)
  })

  it('names downloads after the title', () => {
    expect(posterFileBase('himmel-der-geburt', 'Lena Marie')).toBe('himmel-der-geburt-lena-marie')
    expect(posterFileBase('sky-of-birth', '  ')).toBe('sky-of-birth-kaydo')
  })
})
