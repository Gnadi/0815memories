/**
 * Physical formats for a printed scrapbook, and the arithmetic that maps the
 * editor's 800 × 600 design space onto them.
 *
 * The editor's canvas is exactly 4:3. That is not an accident worth losing: a
 * 4:3 book format lets every scrapbook ever made in this app be ordered without
 * relaying it out, so the formats below are all 4:3 and the design space maps
 * onto them by a pure scale. `fitDesignToFormat` still handles the general case
 * — it centres and letterboxes — so adding a non-4:3 format later degrades
 * gracefully instead of silently cropping somebody's cover.
 */

import { DESIGN_WIDTH, DESIGN_HEIGHT } from './scrapbookStyles'

export const MM_PER_INCH = 25.4

/** What every print network asks for, and what we render at. */
export const PRINT_DPI = 300

/**
 * Below this the printed photo is visibly soft. Prodigi and Peecho both quote
 * 300 DPI as the target; these are the thresholds at which we start telling the
 * user rather than the thresholds at which a printer refuses the file.
 */
export const DPI_WARNING = 180
export const DPI_ERROR = 100

/**
 * Keep-out zone at the page edge. The print networks generate bleed and trim
 * marks themselves and cut with a tolerance, so anything closer than this to
 * the edge may or may not survive the guillotine.
 */
export const SAFETY_MARGIN_MM = 10

export const PRINT_FORMATS = [
  {
    id: 'landscape-28x21',
    widthMm: 280,
    heightMm: 210,
    labelKey: 'print.formats.landscape28x21',
  },
  {
    id: 'landscape-20x15',
    widthMm: 200,
    heightMm: 150,
    labelKey: 'print.formats.landscape20x15',
  },
]

export const DEFAULT_FORMAT_ID = 'landscape-28x21'

export function getFormat(formatId = DEFAULT_FORMAT_ID) {
  return PRINT_FORMATS.find((f) => f.id === formatId) || PRINT_FORMATS[0]
}

/**
 * Page-count and binding rules per product.
 *
 * NOTE: these are the documented print-network minimums for photo books and are
 * deliberately conservative. They are *not* yet the Peecho catalogue's own
 * numbers — that catalogue is only readable with a merchant account, so Phase 4
 * replaces this table with what the provider actually reports. Until then the
 * preflight is stricter than the printer, never looser.
 */
export const PRINT_PRODUCTS = {
  hardcover: { id: 'hardcover', minPages: 24, maxPages: 300, requiresEvenPages: true },
  softcover: { id: 'softcover', minPages: 20, maxPages: 300, requiresEvenPages: true },
}

export const DEFAULT_PRODUCT_ID = 'hardcover'

export function getProduct(productId = DEFAULT_PRODUCT_ID) {
  return PRINT_PRODUCTS[productId] || PRINT_PRODUCTS[DEFAULT_PRODUCT_ID]
}

export function mmToPx(mm, dpi = PRINT_DPI) {
  return (mm / MM_PER_INCH) * dpi
}

export function pxToMm(px, dpi = PRINT_DPI) {
  return (px / dpi) * MM_PER_INCH
}

/** The pixel dimensions one page of `format` is rendered at. */
export function formatPixelSize(format, dpi = PRINT_DPI) {
  return {
    width: Math.round(mmToPx(format.widthMm, dpi)),
    height: Math.round(mmToPx(format.heightMm, dpi)),
  }
}

/**
 * How the design space sits on the page: a uniform scale plus the offset that
 * centres it. For a 4:3 format both offsets are zero and `scale` is the only
 * number that matters.
 */
export function fitDesignToFormat(format, dpi = PRINT_DPI) {
  const { width, height } = formatPixelSize(format, dpi)
  const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT)
  return {
    width,
    height,
    scale,
    offsetX: (width - DESIGN_WIDTH * scale) / 2,
    offsetY: (height - DESIGN_HEIGHT * scale) / 2,
  }
}

/** One design pixel, in millimetres on the printed page. */
export function designPxToMm(px, format) {
  const { scale } = fitDesignToFormat(format)
  return pxToMm(px * scale)
}

/** A millimetre measurement, in design pixels. */
export function mmToDesignPx(mm, format) {
  const { scale } = fitDesignToFormat(format)
  return mmToPx(mm) / scale
}

/**
 * The safe area as a rectangle in design coordinates. Anything a user placed
 * outside this may be trimmed off.
 */
export function safeAreaDesignRect(format, marginMm = SAFETY_MARGIN_MM) {
  const inset = mmToDesignPx(marginMm, format)
  return {
    x: inset,
    y: inset,
    width: DESIGN_WIDTH - inset * 2,
    height: DESIGN_HEIGHT - inset * 2,
  }
}

/**
 * The resolution a photo is actually printed at.
 *
 * `sourcePx` is how many pixels of the original image are sampled across
 * `destDesignPx` of page — which is what `computeCoverRect` already works out
 * when it crops. Zooming into a photo raises the destination size without
 * raising the source, which is exactly the case this has to catch.
 */
export function effectiveDpi(sourcePx, destDesignPx, format) {
  const mm = designPxToMm(destDesignPx, format)
  if (!(mm > 0) || !(sourcePx > 0)) return 0
  return sourcePx / (mm / MM_PER_INCH)
}
