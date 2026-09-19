import { describe, it, expect } from 'vitest'
import {
  DEFAULT_FORMAT_ID,
  MM_PER_INCH,
  PRINT_DPI,
  PRINT_FORMATS,
  designPxToMm,
  effectiveDpi,
  fitDesignToFormat,
  formatPixelSize,
  getFormat,
  getProduct,
  mmToDesignPx,
  safeAreaDesignRect,
} from '../utils/printFormats'
import { DESIGN_WIDTH, DESIGN_HEIGHT, polaroidLayout, resolveTextStyle } from '../utils/scrapbookStyles'

const format = getFormat(DEFAULT_FORMAT_ID)

describe('print formats', () => {
  it('keeps every offered format at the editor’s 4:3 aspect', () => {
    // The whole reason existing scrapbooks are orderable without being relaid
    // out. A format that drifts off 4:3 letterboxes somebody's cover.
    for (const f of PRINT_FORMATS) {
      expect(f.widthMm / f.heightMm).toBeCloseTo(DESIGN_WIDTH / DESIGN_HEIGHT, 5)
    }
  })

  it('sizes a page at 300 dots per inch', () => {
    const { width, height } = formatPixelSize(format)
    expect(width).toBe(Math.round((280 / MM_PER_INCH) * PRINT_DPI))
    expect(height).toBe(Math.round((210 / MM_PER_INCH) * PRINT_DPI))
    expect(width).toBeGreaterThan(3300)
  })

  it('maps the design space onto a 4:3 page with no letterboxing', () => {
    // Not exactly zero: the page is rounded to whole pixels for the canvas, and
    // 280 × 210 mm at 300 dpi does not land on integers in both axes. What has
    // to hold is that the leftover is sub-pixel — invisible on paper — rather
    // than a band of background down the side.
    const fit = fitDesignToFormat(format)
    expect(fit.offsetX).toBeLessThan(1)
    expect(fit.offsetY).toBeLessThan(1)
    expect(fit.scale).toBeCloseTo(fit.width / DESIGN_WIDTH, 3)
  })

  it('centres the design space on a page that is not 4:3', () => {
    const square = { widthMm: 210, heightMm: 210 }
    const fit = fitDesignToFormat(square)
    expect(fit.offsetX).toBeCloseTo(0, 1)
    expect(fit.offsetY).toBeGreaterThan(0)
  })

  it('converts between design pixels and millimetres round trip', () => {
    // Within a tenth of a design pixel, i.e. ~0.03 mm on paper.
    expect(designPxToMm(DESIGN_WIDTH, format)).toBeCloseTo(280, 1)
    expect(Math.abs(mmToDesignPx(280, format) - DESIGN_WIDTH)).toBeLessThan(0.2)
  })

  it('puts the safe area a real 10 mm inside the page', () => {
    const safe = safeAreaDesignRect(format)
    expect(designPxToMm(safe.x, format)).toBeCloseTo(10, 1)
    expect(designPxToMm(safe.width, format)).toBeCloseTo(260, 1)
    expect(designPxToMm(safe.height, format)).toBeCloseTo(190, 1)
  })

  it('reports 300 dpi when a photo brings exactly the pixels the page needs', () => {
    const { width } = formatPixelSize(format)
    expect(effectiveDpi(width, DESIGN_WIDTH, format)).toBeCloseTo(300, 0)
  })

  it('halves the dpi when a photo is stretched across twice the page', () => {
    const { width } = formatPixelSize(format)
    expect(effectiveDpi(width / 2, DESIGN_WIDTH, format)).toBeCloseTo(150, 0)
  })

  it('falls back to a real format and product for unknown ids', () => {
    expect(getFormat('nope').id).toBe(PRINT_FORMATS[0].id)
    expect(getProduct('nope').id).toBe('hardcover')
  })
})

describe('scrapbook style metrics', () => {
  it('lays a polaroid out the way the editor’s padding does', () => {
    const { photo, caption } = polaroidLayout(200, 160, { hasCaption: false })
    expect(photo).toEqual({ x: 8, y: 8, width: 184, height: 128 })
    expect(caption).toBeNull()
  })

  it('gives the caption its line box back out of the photo area', () => {
    const { photo, caption } = polaroidLayout(200, 160, { hasCaption: true })
    expect(photo.height).toBe(108) // 160 - 8 - 24 - (16 + 4)
    expect(caption.y).toBe(photo.y + photo.height + 4)
    expect(caption.width).toBe(200 - (8 + 4) * 2)
  })

  it('never returns a negative box for an element smaller than its own padding', () => {
    const { photo } = polaroidLayout(10, 10, { hasCaption: true })
    expect(photo.width).toBeGreaterThanOrEqual(0)
    expect(photo.height).toBeGreaterThanOrEqual(0)
  })

  it('tracks out display type and leaves the text faces alone', () => {
    const display = resolveTextStyle({ type: 'text', fontFamily: 'display', fontSize: 50, text: 'A' })
    const serif = resolveTextStyle({ type: 'text', fontFamily: 'serif', fontSize: 50, text: 'A' })
    expect(display.letterSpacing).toBeCloseTo(1, 5)
    expect(serif.letterSpacing).toBe(0)
    expect(display.lineHeight).toBeGreaterThan(serif.lineHeight)
  })

  it('renders a sticker as centred emoji at its own size, ignoring the font controls', () => {
    const style = resolveTextStyle({ type: 'sticker', emoji: '🎂', stickerSize: 64, fontFamily: 'serif', textAlign: 'left' })
    expect(style.text).toBe('🎂')
    expect(style.fontSize).toBe(64)
    expect(style.textAlign).toBe('center')
    expect(style.fontFamily).toContain('Emoji')
  })
})
