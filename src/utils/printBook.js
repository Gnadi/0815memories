/**
 * Printed scrapbooks, ordered through Peecho's hosted checkout.
 *
 * Kaydo never takes the order itself. It renders the book into the one PDF a
 * print shop needs, puts that file where Peecho can fetch it, and has Peecho
 * create a checkout for it (the createPrintCheckout Cloud Function). Peecho
 * asks for the product, the shipping address and the payment, then prints and
 * ships the book — so no money passes through Kaydo, and nobody can run up a
 * bill on the Peecho account behind it.
 *
 * What Peecho expects of a book file (its hardcover guideline):
 *  - one PDF of single pages, the front cover first and the back cover last
 *  - an even page count; an odd one gets a white back cover
 *  - no bleed and no crop marks — Peecho adds those itself
 *  - around 300 dpi, RGB
 *  - hardcover books need 24 pages or more
 *
 * This module is the arithmetic of that. Rendering happens in the editor
 * (ScrapbookEditorPage), uploading in printUpload.js, the checkout in
 * functions/peechoCheckout.js.
 */

/** The editor draws every page at this size, in CSS pixels. */
export const PAGE_WIDTH = 800
export const PAGE_HEIGHT = 600

/**
 * A4 landscape. Peecho books come in fixed sizes, and A4 is one every book
 * product has. The editor's 4:3 page sits centred on it, with the page's own
 * background filling the 8.5 mm on either side. A shop set up for a 4:3 size
 * can say so through VITE_PEECHO_PAGE_WIDTH_MM and _HEIGHT_MM.
 */
export const DEFAULT_FORMAT = { widthMm: 297, heightMm: 210 }

export const PRINT_DPI = 300

// Visually lossless at 300 dpi, at roughly half the bytes of 0.95 — which is
// the difference between a 30 MB and a 60 MB upload for a 24-page book.
export const PRINT_JPEG_QUALITY = 0.85

/** The cover picture Peecho's checkout shows next to the product. */
export const THUMBNAIL_WIDTH = 600

// iOS Safari refuses to draw into a canvas above 16,777,216 pixels, and the
// capture of a whole page is one canvas. Kept a little under the limit.
const MAX_CANVAS_AREA = 16_000_000

/** Peecho's hardcover books: fewer pages are only offered other products. */
export const HARDCOVER_MIN_PAGES = 24

/**
 * How long a print file stays in Storage before the purgePrintFiles Cloud
 * Function deletes it. Mirrored by functions/printFiles.js; the order dialog
 * tells the admin this number.
 */
export const PRINT_FILE_RETENTION_DAYS = 30

const DEFAULT_BACKGROUND = '#FDF6EC'
const BLANK_PAGE = '#FFFFFF'
const HEX_COLOR = /^#[0-9a-f]{6}$/i

const CURRENCY = /^[A-Z]{3}$/

/**
 * Printing as configured for this deployment. Off unless VITE_PEECHO_ENABLED
 * is 'true' — the Peecho API key itself lives with the Cloud Function.
 */
export function printConfig(env = import.meta.env) {
  const size = (value, fallback) => {
    const n = Number(value)
    return Number.isFinite(n) && n > 0 ? n : fallback
  }
  const currency = String(env.VITE_PEECHO_CURRENCY ?? '').trim().toUpperCase()
  return {
    enabled: String(env.VITE_PEECHO_ENABLED ?? '').trim() === 'true',
    widthMm: size(env.VITE_PEECHO_PAGE_WIDTH_MM, DEFAULT_FORMAT.widthMm),
    heightMm: size(env.VITE_PEECHO_PAGE_HEIGHT_MM, DEFAULT_FORMAT.heightMm),
    currency: CURRENCY.test(currency) ? currency : '',
  }
}

/**
 * The printed page around an editor page, in the editor's CSS pixels: the
 * print format's shape, just large enough to hold the whole editor page, which
 * sits centred at (offsetX, offsetY). Nothing of the page is cropped; where the
 * shapes differ, the page's background fills the rest.
 */
export function printFrame(format, pageWidth = PAGE_WIDTH, pageHeight = PAGE_HEIGHT) {
  const printAspect = format.widthMm / format.heightMm
  const wider = printAspect > pageWidth / pageHeight
  const width = Math.round(wider ? pageHeight * printAspect : pageWidth)
  const height = Math.round(wider ? pageHeight : pageWidth / printAspect)
  return {
    width,
    height,
    offsetX: (width - pageWidth) / 2,
    offsetY: (height - pageHeight) / 2,
  }
}

/**
 * The capture scale that puts `dpi` dots on every inch of paper, or as close as
 * one canvas can hold.
 */
export function printPixelRatio(frame, format, dpi = PRINT_DPI) {
  const wanted = ((format.widthMm / 25.4) * dpi) / frame.width
  const cap = Math.sqrt(MAX_CANVAS_AREA / (frame.width * frame.height))
  return Math.min(wanted, cap)
}

function colorOr(value, fallback) {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value : fallback
}

/**
 * The book as it will be printed: the editor's first page as the front cover,
 * the others as the inside, and a plain back cover in the front cover's colour.
 * A blank page goes in before the back cover when the count would otherwise be
 * odd, so the back cover is never Peecho's white stand-in.
 *
 * @returns {Array<{kind: 'page', index: number} | {kind: 'blank'|'back', color: string}>}
 */
export function printSequence(pages) {
  const sheets = pages.map((_, index) => ({ kind: 'page', index }))
  if (sheets.length % 2 === 0) sheets.push({ kind: 'blank', color: BLANK_PAGE })
  sheets.push({ kind: 'back', color: colorOr(pages[0]?.backgroundColor, DEFAULT_BACKGROUND) })
  return sheets
}

/**
 * A PDF of full-bleed pages in the print format, built one page at a time so
 * only one page's capture is ever held in memory next to the document.
 *
 * `JsPDF` is passed in rather than imported: it is only loaded once an admin
 * actually prints, and the tests hand in a stand-in.
 */
export function createPrintPdf(JsPDF, { widthMm, heightMm }, { title } = {}) {
  const orientation = widthMm >= heightMm ? 'landscape' : 'portrait'
  const pdf = new JsPDF({ orientation, unit: 'mm', format: [widthMm, heightMm], compress: true })
  if (title) pdf.setProperties({ title })
  let pageCount = 0

  const nextPage = () => {
    if (pageCount > 0) pdf.addPage([widthMm, heightMm], orientation)
    pageCount += 1
  }

  return {
    /** A captured page, as JPEG bytes. */
    addImage(jpeg) {
      nextPage()
      // An alias per page: without one, jsPDF hashes every image to find
      // duplicates, and a print-resolution page is megabytes of hashing.
      pdf.addImage(jpeg, 'JPEG', 0, 0, widthMm, heightMm, `page-${pageCount}`, 'NONE')
    },
    /** A page of one colour — a blank page or the back cover. */
    addPlain(color) {
      nextPage()
      pdf.setFillColor(colorOr(color, BLANK_PAGE))
      pdf.rect(0, 0, widthMm, heightMm, 'F')
    },
    get pageCount() {
      return pageCount
    },
    toBlob() {
      return pdf.output('blob')
    },
  }
}
