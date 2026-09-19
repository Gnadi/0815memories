/**
 * Print-quality rendering of a scrapbook.
 *
 * The screen export in ScrapbookEditorPage photographs the live editor with
 * html2canvas at 1600 × 1200 — fine for a download, and about 13 cm wide once a
 * printer puts 300 dots in every inch of it. A book has to be drawn rather than
 * photographed: this module rebuilds each page from the stored element model
 * straight onto a canvas the size of the physical page, so photos are sampled
 * from their originals at whatever resolution the page actually needs and text
 * is painted at print size instead of being scaled up from screen pixels.
 *
 * It shares its geometry with the editor on purpose. `drawImageCovered` is the
 * same crop the editor previews, `drawTextBlock` the same glyph placement the
 * screen export already uses, and everything stylistic comes from
 * scrapbookStyles — so what the family arranged is what the press receives.
 *
 * What it deliberately does *not* reproduce is the editor's chrome: the 2px
 * border ScrapbookCanvas draws around the page is an editor affordance, and it
 * sits exactly where the guillotine lands. Printing it would put a ragged line
 * along every trimmed edge.
 */

import jsPDF from 'jspdf'
import { drawImageCovered } from './collageRenderer'
import { drawTextBlock } from './canvasText'
import { prefetchDecryptedMedia } from '../components/media/useDecryptedMedia'
import {
  DESIGN_WIDTH,
  DESIGN_HEIGHT,
  BACKGROUND_PATTERNS,
  DEFAULT_PAGE_BACKGROUND,
  POLAROID,
  PHOTO_CORNER_RADIUS,
  CAPTION_COLOR,
  FONT_STACKS,
  EMOJI_FONT_STACK,
  polaroidLayout,
  resolveTextStyle,
} from './scrapbookStyles'
import { fitDesignToFormat, getFormat, PRINT_DPI } from './printFormats'

/**
 * JPEG quality for page images. Photo books are photographs: 0.94 is past the
 * point where artefacts survive being printed, and the file still has to travel
 * to a print network over somebody's home upload.
 */
export const PRINT_JPEG_QUALITY = 0.94

/** A photo that never decrypts must not hold a whole book's render hostage. */
const IMAGE_TIMEOUT_MS = 20000

// ─── Background ───────────────────────────────────────────────────────────────

function drawBackground(ctx, page) {
  ctx.save()
  ctx.fillStyle = page.backgroundColor || DEFAULT_PAGE_BACKGROUND
  ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT)
  ctx.restore()

  const pattern = BACKGROUND_PATTERNS[page.backgroundPattern]
  if (pattern) drawPattern(ctx, pattern)
}

/**
 * Stamp a background pattern across the page.
 *
 * The editor gets these from CSS gradients, which have no canvas equivalent, so
 * each one is redrawn from the tile geometry in scrapbookStyles.
 */
function drawPattern(ctx, pattern) {
  ctx.save()
  ctx.fillStyle = pattern.color

  if (pattern.kind === 'dot') {
    const { w, h } = pattern.tile
    // A radial-gradient dot sits in the middle of its tile.
    for (let y = h / 2; y < DESIGN_HEIGHT; y += h) {
      for (let x = w / 2; x < DESIGN_WIDTH; x += w) {
        ctx.beginPath()
        ctx.arc(x, y, pattern.radius, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  } else if (pattern.kind === 'grid') {
    const { w, h } = pattern.tile
    // Both gradients put their line at the *start* of each tile.
    for (let y = 0; y < DESIGN_HEIGHT; y += h) ctx.fillRect(0, y, DESIGN_WIDTH, pattern.thickness)
    for (let x = 0; x < DESIGN_WIDTH; x += w) ctx.fillRect(x, 0, pattern.thickness, DESIGN_HEIGHT)
  } else if (pattern.kind === 'hline') {
    const { h } = pattern.tile
    for (let y = pattern.offset; y < DESIGN_HEIGHT; y += h) {
      ctx.fillRect(0, y, DESIGN_WIDTH, pattern.thickness)
    }
  }

  ctx.restore()
}

// ─── Elements ─────────────────────────────────────────────────────────────────

function roundedRectPath(ctx, x, y, w, h, radius) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2))
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
    return
  }
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Draw one line of text clipped to `width`, with an ellipsis when it does not
 * fit — the canvas equivalent of the caption's `truncate`.
 */
function drawTruncatedLine(ctx, text, { x, y, width, font, color, lineHeight }) {
  ctx.save()
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  let value = String(text ?? '')
  if (ctx.measureText(value).width > width) {
    while (value.length > 1 && ctx.measureText(`${value}…`).width > width) {
      value = value.slice(0, -1)
    }
    value = `${value}…`
  }
  ctx.fillText(value, x + width / 2, y + lineHeight / 2)
  ctx.restore()
}

function drawPhotoElement(ctx, element, image, width, height) {
  const imageScale = element.imageScale || 1
  const flipped = !!element.flipped

  if (!element.polaroid) {
    ctx.save()
    roundedRectPath(ctx, 0, 0, width, height, PHOTO_CORNER_RADIUS)
    ctx.clip()
    if (image) drawImageCovered(ctx, image, width, height, imageScale, flipped)
    ctx.restore()
    return
  }

  const hasCaption = !!element.caption
  const { photo, caption } = polaroidLayout(width, height, { hasCaption })

  // The white card, with the editor's shadow-md under it.
  ctx.save()
  ctx.shadowColor = POLAROID.shadow.color
  ctx.shadowBlur = POLAROID.shadow.blur
  ctx.shadowOffsetY = POLAROID.shadow.offsetY
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)
  ctx.restore()

  if (image && photo.width > 0 && photo.height > 0) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(photo.x, photo.y, photo.width, photo.height)
    ctx.clip()
    ctx.translate(photo.x, photo.y)
    drawImageCovered(ctx, image, photo.width, photo.height, imageScale, flipped)
    ctx.restore()
  }

  if (caption) {
    drawTruncatedLine(ctx, element.caption, {
      x: caption.x,
      y: caption.y,
      width: caption.width,
      font: `${POLAROID.captionFontSize}px ${FONT_STACKS.serif}`,
      color: CAPTION_COLOR,
      lineHeight: POLAROID.captionLineHeight,
    })
  }
}

function drawTextElement(ctx, element, width, height) {
  const style = resolveTextStyle(element)
  if (!style.text) return
  drawTextBlock(ctx, {
    text: style.text,
    width,
    height,
    fontSize: style.fontSize,
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    color: style.color,
    textAlign: style.textAlign,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
  })
}

/**
 * Paint a whole page into `ctx`, which must already be transformed so that one
 * unit is one design pixel.
 *
 * `images` maps an element's encrypted `url` to a loaded image. A missing entry
 * renders as an empty frame rather than aborting the book — the preflight is
 * what tells the user about it, ahead of time and by name.
 */
export function drawPrintPage(ctx, page, images = new Map()) {
  drawBackground(ctx, page)

  const sorted = [...(page.elements || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))

  for (const element of sorted) {
    const { x = 0, y = 0, width = 0, height = 0, rotation = 0 } = element
    if (!(width > 0) || !(height > 0)) continue
    // Photo slots nobody filled are placeholders, not content: the editor draws
    // a dashed "tap to add" box, and the printed page gets nothing.
    if (element.type === 'photo' && !element.url) continue

    ctx.save()
    // CSS rotates a box about its centre; so do we.
    ctx.translate(x + width / 2, y + height / 2)
    if (rotation) ctx.rotate((rotation * Math.PI) / 180)
    ctx.translate(-width / 2, -height / 2)

    if (element.type === 'photo') {
      drawPhotoElement(ctx, element, images.get(element.url) || null, width, height)
    } else if (element.type === 'text' || element.type === 'sticker') {
      drawTextElement(ctx, element, width, height)
    }

    ctx.restore()
  }
}

// ─── Page rasterisation ───────────────────────────────────────────────────────

/**
 * Render one page onto `canvas` at the physical size of `format`.
 *
 * The canvas is reused across a whole book: at 300 DPI a 28 × 21 cm page is
 * over 8 megapixels, and allocating one of those per page is how a phone runs
 * out of memory halfway through a 24-page render.
 */
export function renderPageToCanvas(canvas, page, images, format, dpi = PRINT_DPI) {
  const fit = fitDesignToFormat(format, dpi)
  canvas.width = fit.width
  canvas.height = fit.height

  const ctx = canvas.getContext('2d')
  // Letterboxing only ever shows on a format that is not 4:3; filling first
  // means those bars are the page's own background rather than transparency,
  // which JPEG would otherwise turn black.
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = page.backgroundColor || DEFAULT_PAGE_BACKGROUND
  ctx.fillRect(0, 0, fit.width, fit.height)

  ctx.setTransform(fit.scale, 0, 0, fit.scale, fit.offsetX, fit.offsetY)
  drawPrintPage(ctx, page, images)
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  return fit
}

function canvasToJpegBytes(canvas, quality) {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob !== 'function') {
      // jsdom and some older WebViews only have toDataURL. Base64 costs a third
      // more memory, so it is the fallback rather than the path.
      try {
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch (err) {
        reject(err)
      }
      return
    }
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Page could not be encoded'))
          return
        }
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf))).catch(reject)
      },
      'image/jpeg',
      quality
    )
  })
}

// ─── Photo loading ────────────────────────────────────────────────────────────

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = src
  })
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ])
}

/** Every distinct photo URL a set of pages refers to. */
function photoUrls(pages) {
  return [...new Set(
    (pages || []).flatMap((page) => (page.elements || [])
      .filter((el) => el.type === 'photo' && el.url)
      .map((el) => el.url))
  )]
}

async function decodeOne(url, encryptionKey) {
  const resolved = (await withTimeout(
    prefetchDecryptedMedia(url, encryptionKey, 'image/*'),
    IMAGE_TIMEOUT_MS
  )) || url
  return withTimeout(loadImage(resolved), IMAGE_TIMEOUT_MS)
}

/**
 * The natural size of every photo a book uses, without keeping any of them.
 *
 * This is what the preflight needs: it asks how many of an original's pixels
 * land on the page, which is arithmetic over two numbers. Holding the decoded
 * bitmaps to answer that would cost a gigabyte on a large book and buy nothing —
 * each image is released as soon as it has been measured.
 */
export async function loadImageSizes(pages, encryptionKey, { onProgress } = {}) {
  const urls = photoUrls(pages)
  const sizes = new Map()
  const failed = []
  let done = 0

  for (const url of urls) {
    try {
      const img = await decodeOne(url, encryptionKey)
      if (img) sizes.set(url, { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight })
      else failed.push(url)
    } catch {
      failed.push(url)
    }
    done += 1
    onProgress?.({ phase: 'images', done, total: urls.length })
  }

  return { images: sizes, failed }
}

/**
 * How many decoded photos the renderer keeps alive at once.
 *
 * A page holds a handful; keeping a few more than that means the pages either
 * side of a repeated photo still hit rather than decoding it again. Every entry
 * is a full-resolution bitmap — a 12 MP photo is ~48 MB decoded — so this is the
 * number that decides whether a hundred-page book renders or the tab dies.
 */
const IMAGE_CACHE_SIZE = 10

/**
 * A bounded, least-recently-used store of decoded photos.
 *
 * The renderer used to take a Map of every photo in the book, which defeated
 * the point of reusing one page canvas: the canvas stayed at eight megapixels
 * while the images beside it grew without limit.
 */
export function createPrintImageCache(encryptionKey, { maxEntries = IMAGE_CACHE_SIZE } = {}) {
  const cache = new Map()

  return {
    async get(url) {
      if (cache.has(url)) {
        // Re-insert so insertion order stays usage order.
        const hit = cache.get(url)
        cache.delete(url)
        cache.set(url, hit)
        return hit
      }
      let img = null
      try {
        img = await decodeOne(url, encryptionKey)
      } catch {
        img = null
      }
      // Cached even when null: a photo that will not decrypt should be given up
      // on once per book, not once per page it appears on.
      cache.set(url, img)
      while (cache.size > maxEntries) cache.delete(cache.keys().next().value)
      return img
    },
    clear() {
      cache.clear()
    },
  }
}

/**
 * Decrypt and decode every distinct photo a book uses, once.
 *
 * Kept for callers that genuinely want them all in hand at the same time —
 * tests, and rendering a book small enough that it does not matter. The print
 * path streams through `createPrintImageCache` instead.
 */
export async function loadPrintImages(pages, encryptionKey, { onProgress } = {}) {
  const urls = photoUrls(pages)
  const images = new Map()
  const failed = []
  let done = 0

  for (const url of urls) {
    try {
      const img = await decodeOne(url, encryptionKey)
      if (img) images.set(url, img)
      else failed.push(url)
    } catch {
      failed.push(url)
    }
    done += 1
    onProgress?.({ phase: 'images', done, total: urls.length })
  }

  return { images, failed }
}

/**
 * Make sure the faces a book uses are loaded before anything is measured.
 *
 * Canvas text falls back silently: ask for Anton before the browser has it and
 * every title is laid out in Impact, at different widths, with no error
 * anywhere. The editor has usually warmed these already; a print started right
 * after a reload has not.
 */
export async function warmPrintFonts() {
  if (typeof document === 'undefined' || !document.fonts?.load) return
  const faces = [...new Set(Object.values(FONT_STACKS)), EMOJI_FONT_STACK]
  await Promise.all(faces.map((family) => document.fonts.load(`40px ${family}`).catch(() => {})))
  await document.fonts.ready
}

// ─── The book ─────────────────────────────────────────────────────────────────

/**
 * Render `pages` into a print-ready PDF and hand back the Blob.
 *
 * One page of the PDF per page of the book, at the exact physical size of the
 * format, no bleed and no crop marks — every print network in the analysis
 * generates those itself and rejects files that bring their own.
 */
export async function renderScrapbookToPrintPdf(pages, {
  encryptionKey,
  formatId,
  images: providedImages,
  quality = PRINT_JPEG_QUALITY,
  dpi = PRINT_DPI,
  onProgress,
} = {}) {
  const format = getFormat(formatId)
  const total = pages.length

  await warmPrintFonts()

  // Given a map, use it as-is; otherwise stream, keeping only the photos of the
  // page being drawn plus a small tail of recently used ones.
  const cache = providedImages ? null : createPrintImageCache(encryptionKey)
  const failed = []

  const pdf = new jsPDF({
    orientation: format.widthMm >= format.heightMm ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [format.widthMm, format.heightMm],
    compress: false, // the pages are already JPEG; deflating them again costs time and saves nothing
  })

  const canvas = document.createElement('canvas')

  for (let i = 0; i < total; i++) {
    let pageImages = providedImages
    if (!pageImages) {
      pageImages = new Map()
      for (const url of photoUrls([pages[i]])) {
        const img = await cache.get(url)
        if (img) pageImages.set(url, img)
        else if (!failed.includes(url)) failed.push(url)
      }
    }

    renderPageToCanvas(canvas, pages[i], pageImages, format, dpi)
    const data = await canvasToJpegBytes(canvas, quality)
    if (i > 0) pdf.addPage([format.widthMm, format.heightMm], format.widthMm >= format.heightMm ? 'landscape' : 'portrait')
    pdf.addImage(data, 'JPEG', 0, 0, format.widthMm, format.heightMm)
    onProgress?.({ phase: 'pages', done: i + 1, total })
  }

  // Let the page bitmap and the decoded photos go before the PDF blob doubles
  // peak memory.
  canvas.width = 0
  canvas.height = 0
  cache?.clear()

  return { blob: pdf.output('blob'), format, pageCount: total, failedImages: failed }
}
