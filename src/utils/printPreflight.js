/**
 * Preflight: everything that should be said *before* a book is paid for.
 *
 * A print network will happily take a file whose cover photo is 400 pixels wide
 * and whose title is 3 mm from the trim, print it, and post it. The customer
 * finds out three weeks later. This module works out the same things the press
 * would, from the stored element model, and says them while the page is still
 * editable.
 *
 * Every check is pure — geometry and arithmetic over the page data plus the
 * natural size of each loaded photo — so it is testable without a canvas, and
 * the same functions serve the dialog and, later, the order endpoint.
 */

import { computeCoverRect } from './collageRenderer'
import { DESIGN_WIDTH, DESIGN_HEIGHT, polaroidLayout } from './scrapbookStyles'
import {
  DPI_ERROR,
  DPI_WARNING,
  SAFETY_MARGIN_MM,
  effectiveDpi,
  getFormat,
  getProduct,
  safeAreaDesignRect,
} from './printFormats'

export const ISSUE = {
  VERY_LOW_RESOLUTION: 'veryLowResolution',
  LOW_RESOLUTION: 'lowResolution',
  OUTSIDE_SAFE_AREA: 'outsideSafeArea',
  EMPTY_SLOT: 'emptySlot',
  MISSING_PHOTO: 'missingPhoto',
  TOO_FEW_PAGES: 'tooFewPages',
  TOO_MANY_PAGES: 'tooManyPages',
  ODD_PAGE_COUNT: 'oddPageCount',
}

/** `error` blocks the order, `warning` is worth reading, `decision` needs an answer. */
export const LEVEL = { ERROR: 'error', WARNING: 'warning', DECISION: 'decision' }

/**
 * The axis-aligned box a rotated element actually occupies. A title rotated 8°
 * for effect reaches further into the trim than its unrotated box suggests, and
 * that overhang is precisely what gets cut off.
 */
export function rotatedBounds({ x = 0, y = 0, width = 0, height = 0, rotation = 0 }) {
  const rad = (rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const cx = x + width / 2
  const cy = y + height / 2

  const corners = [
    [-width / 2, -height / 2],
    [width / 2, -height / 2],
    [width / 2, height / 2],
    [-width / 2, height / 2],
  ].map(([dx, dy]) => [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos])

  const xs = corners.map((c) => c[0])
  const ys = corners.map((c) => c[1])
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
  }
}

/** The part of a photo element the image itself fills, in design pixels. */
export function photoImageBox(element) {
  const { width = 0, height = 0 } = element
  if (!element.polaroid) return { width, height }
  return polaroidLayout(width, height, { hasCaption: !!element.caption }).photo
}

/**
 * How many dots per inch a photo is actually printed at.
 *
 * The crop decides this, not the file: `computeCoverRect` reports which slice of
 * the original ends up on the page, and a 3× zoom into a 12 MP photo prints the
 * same as a 1.3 MP one.
 */
export function photoDpi(element, image, format) {
  if (!image) return null
  const box = photoImageBox(element)
  const iw = image.naturalWidth ?? image.width
  const ih = image.naturalHeight ?? image.height
  if (!iw || !ih || !(box.width > 0)) return null

  const { sw } = computeCoverRect(iw, ih, box.width, box.height, element.imageScale || 1)
  return effectiveDpi(sw, box.width, format)
}

function isInsideSafeArea(bounds, safe) {
  return bounds.left >= safe.x - 0.5
    && bounds.top >= safe.y - 0.5
    && bounds.right <= safe.x + safe.width + 0.5
    && bounds.bottom <= safe.y + safe.height + 0.5
}

/** Does this element carry anything a reader would miss if it were trimmed? */
function hasTrimmableContent(element) {
  if (element.type === 'text') return !!element.text?.trim()
  if (element.type === 'sticker') return !!element.emoji
  // A photo is meant to run to the edge often enough that its own overhang is a
  // design choice; only its polaroid caption is text that must survive.
  return element.type === 'photo' && !!element.polaroid && !!element.caption
}

/**
 * Check one page. `images` maps encrypted URL → loaded image, exactly as the
 * renderer takes it; a URL missing from it is a photo that could not be read.
 */
export function checkPage(page, images, format, pageIndex, { marginMm = SAFETY_MARGIN_MM } = {}) {
  const issues = []
  const safe = safeAreaDesignRect(format, marginMm)

  for (const element of page.elements || []) {
    const base = { pageIndex, elementId: element.id, elementType: element.type }

    if (element.type === 'photo' && !element.url) {
      issues.push({ ...base, code: ISSUE.EMPTY_SLOT, level: LEVEL.WARNING })
      continue
    }

    if (element.type === 'photo') {
      const image = images?.get(element.url)
      if (!image) {
        issues.push({ ...base, code: ISSUE.MISSING_PHOTO, level: LEVEL.ERROR })
      } else {
        const dpi = photoDpi(element, image, format)
        if (dpi !== null && dpi < DPI_ERROR) {
          issues.push({ ...base, code: ISSUE.VERY_LOW_RESOLUTION, level: LEVEL.ERROR, dpi: Math.round(dpi) })
        } else if (dpi !== null && dpi < DPI_WARNING) {
          issues.push({ ...base, code: ISSUE.LOW_RESOLUTION, level: LEVEL.WARNING, dpi: Math.round(dpi) })
        }
      }
    }

    if (hasTrimmableContent(element) && !isInsideSafeArea(rotatedBounds(element), safe)) {
      issues.push({ ...base, code: ISSUE.OUTSIDE_SAFE_AREA, level: LEVEL.WARNING, marginMm })
    }
  }

  return issues
}

/**
 * What the page count has to become for this product, and how far away it is.
 *
 * Binding is physical: a sheet has two sides, so the count is always even, and
 * a press needs a minimum spine to glue. Neither is negotiable, which is why
 * these come back as a decision rather than as advice.
 */
export function pageCountPlan(pageCount, product) {
  const { minPages, maxPages, requiresEvenPages } = product
  let target = Math.max(pageCount, minPages)
  if (requiresEvenPages && target % 2 !== 0) target += 1

  return {
    current: pageCount,
    target,
    pagesToAdd: Math.max(0, target - pageCount),
    exceedsMaximum: pageCount > maxPages,
    maxPages,
    minPages,
  }
}

/**
 * The page sequence that goes to the press: the book, plus however many blank
 * pages the binding needs.
 *
 * Padding pages inherit the last page's background rather than arriving stark
 * white — a book that ends in four sheets of a different colour reads as a
 * misprint, not as blank pages.
 */
export function assemblePrintPages(pages, product) {
  const plan = pageCountPlan(pages.length, product)
  if (plan.pagesToAdd === 0) return { pages: [...pages], added: 0, plan }

  const last = pages[pages.length - 1] || {}
  const padding = Array.from({ length: plan.pagesToAdd }, (_, i) => ({
    id: `print-pad-${i}`,
    backgroundColor: last.backgroundColor,
    backgroundPattern: last.backgroundPattern,
    elements: [],
  }))

  return { pages: [...pages, ...padding], added: plan.pagesToAdd, plan }
}

/**
 * Run every check over a whole book.
 *
 * `ok` means nothing blocks an order. It is deliberately independent of
 * `plan.pagesToAdd`: needing blank pages is a question for the user, not a
 * fault in the book.
 */
export function runPreflight(pages, images, { formatId, productId, marginMm = SAFETY_MARGIN_MM } = {}) {
  const format = getFormat(formatId)
  const product = getProduct(productId)

  const issues = (pages || []).flatMap((page, i) => checkPage(page, images, format, i, { marginMm }))
  const plan = pageCountPlan((pages || []).length, product)

  if (plan.exceedsMaximum) {
    issues.push({ code: ISSUE.TOO_MANY_PAGES, level: LEVEL.ERROR, current: plan.current, maxPages: plan.maxPages })
  }
  if (plan.pagesToAdd > 0) {
    issues.push({
      code: plan.current < plan.minPages ? ISSUE.TOO_FEW_PAGES : ISSUE.ODD_PAGE_COUNT,
      level: LEVEL.DECISION,
      current: plan.current,
      target: plan.target,
      pagesToAdd: plan.pagesToAdd,
      minPages: plan.minPages,
    })
  }

  const errors = issues.filter((i) => i.level === LEVEL.ERROR)
  const warnings = issues.filter((i) => i.level === LEVEL.WARNING)
  const decisions = issues.filter((i) => i.level === LEVEL.DECISION)

  return { ok: errors.length === 0, issues, errors, warnings, decisions, plan, format, product }
}

/** The design space, re-exported so callers do not reach past this module. */
export const DESIGN_SIZE = { width: DESIGN_WIDTH, height: DESIGN_HEIGHT }
