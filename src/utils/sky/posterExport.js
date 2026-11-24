/**
 * Turning a sky poster into files: the free downloads (PNG and PDF), shared by
 * the birth sky in a child's journal and the public page on the landing site,
 * and the print file of a poster ordered from Peecho.
 */
import { renderSkyPosterCanvas, POSTER_RATIO } from './skyRenderer'

// A4 at 300 dpi. A3 at 300 dpi (3508 × 4961) is over the ~16.7 megapixel
// canvas limit of iOS Safari, so A3 renders at 275 dpi — still sharp on paper.
export const A4_WIDTH = 2480
export const A3_WIDTH = 3210

// iOS Safari refuses to draw into a canvas above 16,777,216 pixels. Kept a
// little under the limit, as utils/printBook.js does for book pages.
const MAX_CANVAS_AREA = 16_000_000
const PRINT_DPI = 300
const MM_PER_INCH = 25.4

/**
 * The poster as Peecho prints it: A3 portrait unless the deployment names
 * another size through VITE_PEECHO_POSTER_WIDTH_MM and _HEIGHT_MM. The poster
 * is drawn at 1 : √2, so only ISO sizes (A4, A3, A2, …) fit it; any other size
 * falls back to A3 rather than stretching the sky.
 */
export const DEFAULT_POSTER_FORMAT = { widthMm: 297, heightMm: 420 }

export function posterPrintFormat(env = import.meta.env) {
  const widthMm = Number(env.VITE_PEECHO_POSTER_WIDTH_MM)
  const heightMm = Number(env.VITE_PEECHO_POSTER_HEIGHT_MM)
  const valid = Number.isFinite(widthMm) && Number.isFinite(heightMm) && widthMm >= 100 && heightMm >= 100
  if (!valid || Math.abs(heightMm / widthMm - POSTER_RATIO) > 0.01) return DEFAULT_POSTER_FORMAT
  return { widthMm, heightMm }
}

/** Pixels across for a print of `format`: 300 dpi, or as near as a phone can draw. */
export function posterPrintWidth(format) {
  const atDpi = Math.round((format.widthMm / MM_PER_INCH) * PRINT_DPI)
  const canvasLimit = Math.floor(Math.sqrt(MAX_CANVAS_AREA / POSTER_RATIO))
  return Math.min(atDpi, canvasLimit)
}

export function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))), type, quality)
  })
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  // Revoked on the next tick so the click has taken the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** The file name a download starts with, from the poster's title. */
export function posterFileBase(prefix, title) {
  const slug = (title || '').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-')
  return `${prefix}-${slug || 'kaydo'}`
}

export async function downloadPosterPng(options, fileBase) {
  const canvas = renderSkyPosterCanvas(A4_WIDTH, options)
  downloadBlob(await canvasToBlob(canvas, 'image/png'), `${fileBase}.png`)
}

export async function downloadPosterPdf(options, fileBase, format) {
  const { jsPDF } = await import('jspdf')
  const width = format === 'a3' ? A3_WIDTH : A4_WIDTH
  const canvas = renderSkyPosterCanvas(width, options)
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageW, Math.min(pageH, pageW * POSTER_RATIO))
  pdf.save(`${fileBase}-${format}.pdf`)
}

/** The picture Peecho's checkout shows next to the product. */
const THUMBNAIL_WIDTH = 600

/**
 * The print file of an ordered poster: a one-page PDF at the print size, and
 * its thumbnail. Like a book page, no bleed and no crop marks: Peecho adds
 * those itself.
 *
 * @returns {Promise<{ pdf: Blob, thumbnail: Blob, pageCount: 1, format: { widthMm: number, heightMm: number } }>}
 */
export async function renderPosterPrintFile(options, format = posterPrintFormat()) {
  const { jsPDF } = await import('jspdf')
  const canvas = renderSkyPosterCanvas(posterPrintWidth(format), options)
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [format.widthMm, format.heightMm] })
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, format.widthMm, format.heightMm)
  const thumbnail = await canvasToBlob(renderSkyPosterCanvas(THUMBNAIL_WIDTH, options), 'image/jpeg', 0.85)
  return { pdf: pdf.output('blob'), thumbnail, pageCount: 1, format }
}
