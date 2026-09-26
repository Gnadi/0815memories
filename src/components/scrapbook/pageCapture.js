/**
 * Photographing the book's pages one after another — for the PDF download and
 * for the print file alike.
 *
 * The editor only ever mounts the page it is showing, so a capture has to walk
 * the book: switch to a page, let it paint, wait until its photos have landed
 * on their export canvases, then hand the element to html2canvas.
 */
import { prefetchDecryptedMedia } from '../media/useDecryptedMedia'
import { waitForExportCanvases, EXPORT_PENDING_TIMEOUT_MS } from './exportReady'

/**
 * Start fetching and decrypting every photo of the book before the first
 * capture, instead of page by page at the moment each is captured. Capped, so
 * one photo that never arrives cannot hold the capture here.
 */
export function warmBookPhotos(pages, encryptionKey, timeoutMs = EXPORT_PENDING_TIMEOUT_MS) {
  return Promise.race([
    Promise.all(
      pages.flatMap((page) => (page.elements || [])
        .filter((el) => el.type === 'photo' && el.url)
        .map((el) => prefetchDecryptedMedia(el.url, encryptionKey, 'image/*')))
    ),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ])
}

// One frame for the React commit to paint, one for passive effects (the export
// canvases draw in useEffect) to flush, one spare.
const threeFrames = () => new Promise((resolve) => (
  requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))
))

/**
 * html2canvas of `element` at its unscaled size.
 *
 * The editor fits the page to the screen with a transform (scale(0.4) on a
 * phone), and html2canvas sizes its output from getBoundingClientRect() — the
 * *visual* size — so the capture would come out small and be stretched to fill
 * the PDF page. The transform is lifted for the length of the capture.
 */
async function captureElement(element, html2canvas, { width, height, scale }) {
  const savedTransform = element.style.transform
  const savedTransformOrigin = element.style.transformOrigin
  element.style.transform = 'none'
  element.style.transformOrigin = 'top left'
  try {
    return await html2canvas(element, {
      useCORS: true,
      // Photos and text are drawn onto <canvas> elements at this same ratio,
      // so their pixels land in the capture one for one.
      scale,
      width,
      height,
      backgroundColor: null,
      logging: false,
    })
  } finally {
    element.style.transform = savedTransform
    element.style.transformOrigin = savedTransformOrigin
  }
}

/**
 * Capture pages 0 … count-1 in order and pass each to `onPage(canvas, index)`,
 * which is awaited before the next page is switched to — so a caller that
 * encodes and drops each capture holds one page in memory, not the book.
 *
 * `switchPage(index)` must commit synchronously (flushSync), or html2canvas
 * reads whatever page was mounted before. Returns false when `isCancelled`
 * stopped it early.
 */
export async function capturePages({
  count,
  getElement,
  switchPage,
  html2canvas,
  width,
  height,
  scale,
  onPage,
  isCancelled = () => false,
}) {
  for (let index = 0; index < count; index++) {
    if (isCancelled()) return false
    switchPage(index)
    await threeFrames()
    // Frames alone are a guess; photos land on their canvas whenever their
    // decode finishes. Hold the capture until they actually have.
    await waitForExportCanvases(getElement())
    if (isCancelled()) return false
    const canvas = await captureElement(getElement(), html2canvas, { width, height, scale })
    await onPage(canvas, index)
  }
  return true
}

/** A canvas as JPEG bytes, for jsPDF. */
export function canvasToJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Could not encode the page'))
        return
      }
      blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject)
    }, 'image/jpeg', quality)
  })
}

/** A small JPEG of `canvas`, `width` pixels wide — the checkout's cover picture. */
export function canvasThumbnail(canvas, width, quality = 0.85) {
  const height = Math.round((canvas.height / canvas.width) * width)
  const thumb = document.createElement('canvas')
  thumb.width = width
  thumb.height = height
  const ctx = thumb.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(canvas, 0, 0, width, height)
  return new Promise((resolve, reject) => {
    thumb.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the cover'))), 'image/jpeg', quality)
  })
}

/**
 * Let go of a capture's pixels now rather than whenever the collector gets to
 * it. A print-resolution page is ~35 MB of bitmap, and phones run out quickly.
 */
export function releaseCanvas(canvas) {
  canvas.width = 0
  canvas.height = 0
}
