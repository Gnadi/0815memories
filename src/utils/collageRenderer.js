// Canvas 2D rendering for collages.
//
// The collage deliberately does not go through html2canvas (the route the
// scrapbook PDF export takes): its slots are rounded, pill, circular and
// rotated shapes, and html2canvas clips those wrong — CanvasElement already
// works around exactly that by drawing photos into a <canvas> during export.
// Drawing the whole collage here means the on-screen preview, the gallery
// thumbnail and the exported file all come from one function.

import { getTemplate, templateSize, DEFAULT_BORDER } from '../components/collage/collageTemplates'
import { paintDecoration, roundRectPath } from '../components/collage/collageDecorations'
import { prefetchDecryptedMedia } from '../components/media/useDecryptedMedia'

/**
 * The source rectangle to draw so an image fills a box like `object-fit: cover`,
 * zoomed by `scale` and panned by `offsetX`/`offsetY` (−1 … 1, where ±1 is the
 * far edge of the image).
 *
 * Pure and exported for its own test — the whole crop behaviour of the feature
 * rides on it.
 */
export function computeCoverRect(imgW, imgH, boxW, boxH, scale = 1, offsetX = 0, offsetY = 0) {
  if (!imgW || !imgH || !boxW || !boxH) return { sx: 0, sy: 0, sw: 0, sh: 0 }
  // Not clamped to 1: the scrapbook editor, which shares this maths, offers
  // 0.5× as a way to zoom *out* of the cover crop.
  const zoom = scale || 1

  // Cover: the largest source rect with the box's aspect ratio.
  let coverW, coverH
  if (imgW / imgH > boxW / boxH) {
    coverH = imgH
    coverW = (boxW / boxH) * imgH
  } else {
    coverW = imgW
    coverH = (boxH / boxW) * imgW
  }

  const sw = coverW / zoom
  const sh = coverH / zoom

  // Centre the crop, then pan across whatever room the full image leaves. When
  // the crop is larger than the image (zoom < 1) there is no room to pan.
  const centreX = (imgW - sw) / 2
  const centreY = (imgH - sh) / 2
  const sx = centreX > 0 ? clamp(centreX + (offsetX || 0) * centreX, 0, centreX * 2) : centreX
  const sy = centreY > 0 ? clamp(centreY + (offsetY || 0) * centreY, 0, centreY * 2) : centreY

  return { sx, sy, sw, sh }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/**
 * Draw an image into the current context filling w × h, cover-cropped, zoomed
 * and optionally mirrored. Shared with the scrapbook canvas element so the two
 * editors crop photos identically.
 */
export function drawImageCovered(ctx, img, w, h, scale = 1, flipped = false, offsetX = 0, offsetY = 0) {
  const iw = img.naturalWidth ?? img.width
  const ih = img.naturalHeight ?? img.height
  if (!iw || !ih) return
  const { sx, sy, sw, sh } = computeCoverRect(iw, ih, w, h, scale, offsetX, offsetY)
  if (!sw || !sh) return

  if (flipped) {
    ctx.save()
    ctx.translate(w, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
    ctx.restore()
  } else {
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
  }
}

/**
 * A template slot's pixel geometry on a canvas of `width` × `height`, with the
 * border gap applied.
 */
export function slotRect(slot, width, height, gap = 0) {
  const inset = (gap || 0) * width / 2
  const x = slot.x * width + inset
  const y = slot.y * height + inset
  const w = Math.max(1, slot.w * width - inset * 2)
  const h = Math.max(1, slot.h * height - inset * 2)
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 }
}

// Path for a slot shape, in local coordinates centred on the origin.
function slotPath(ctx, w, h, shape, radiusFraction) {
  const hw = w / 2
  const hh = h / 2
  ctx.beginPath()

  if (shape === 'circle') {
    ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2)
    return
  }

  // A window arch: semicircular top, straight sides and base.
  if (shape === 'arch') {
    const cap = Math.min(hw, h * 0.5)
    ctx.moveTo(-hw, hh)
    ctx.lineTo(-hw, -hh + cap)
    ctx.quadraticCurveTo(-hw, -hh, -hw + cap, -hh)
    ctx.lineTo(hw - cap, -hh)
    ctx.quadraticCurveTo(hw, -hh, hw, -hh + cap)
    ctx.lineTo(hw, hh)
    ctx.closePath()
    return
  }

  const short = Math.min(w, h)
  const r = shape === 'pill'
    ? short / 2
    : shape === 'rect'
      ? 0
      : clamp((radiusFraction ?? DEFAULT_BORDER.radius) * short, 0, short / 2)

  if (r <= 0) {
    ctx.rect(-hw, -hh, w, h)
    return
  }

  // roundRect is not in jsdom and not in older Safari; the manual path keeps
  // the renderer usable everywhere rather than silently dropping corners.
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(-hw, -hh, w, h, r)
    return
  }
  ctx.moveTo(-hw + r, -hh)
  ctx.lineTo(hw - r, -hh)
  ctx.quadraticCurveTo(hw, -hh, hw, -hh + r)
  ctx.lineTo(hw, hh - r)
  ctx.quadraticCurveTo(hw, hh, hw - r, hh)
  ctx.lineTo(-hw + r, hh)
  ctx.quadraticCurveTo(-hw, hh, -hw, hh - r)
  ctx.lineTo(-hw, -hh + r)
  ctx.quadraticCurveTo(-hw, -hh, -hw, -hh + r)
  ctx.closePath()
}

/**
 * Paint a template background: a colour string, or a gradient spec
 * ({ type: 'linear'|'radial', colors, angle }).
 */
function paintBackground(ctx, background, width, height) {
  if (!background) {
    ctx.fillStyle = '#FDF6EC'
  } else if (typeof background === 'string') {
    ctx.fillStyle = background
  } else if (background.type === 'radial') {
    const [cx, cy] = background.center || [0.5, 0.5]
    const gradient = ctx.createRadialGradient(
      cx * width, cy * height, 0,
      cx * width, cy * height, Math.max(width, height) * (background.radius ?? 0.8)
    )
    const colors = background.colors || ['#FFFFFF', '#000000']
    colors.forEach((color, i) => gradient.addColorStop(i / Math.max(1, colors.length - 1), color))
    ctx.fillStyle = gradient
  } else {
    // Linear, by angle in degrees (0 = left→right, 90 = top→bottom).
    const angle = ((background.angle ?? 90) * Math.PI) / 180
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    const gradient = ctx.createLinearGradient(
      width / 2 - (dx * width) / 2, height / 2 - (dy * height) / 2,
      width / 2 + (dx * width) / 2, height / 2 + (dy * height) / 2
    )
    const colors = background.colors || ['#FFFFFF', '#000000']
    colors.forEach((color, i) => gradient.addColorStop(i / Math.max(1, colors.length - 1), color))
    ctx.fillStyle = gradient
  }
  ctx.fillRect(0, 0, width, height)
}

/**
 * The photo mat a slot sits on — the white polaroid border, the cream card in
 * the "bloom" template. Drawn (with its shadow) before the photo itself.
 */
function paintFrame(ctx, frame, w, h, width) {
  const pad = (frame.pad ?? 0.02) * width
  const padBottom = (frame.padBottom ?? frame.pad ?? 0.02) * width
  const fw = w + pad * 2
  const fh = h + pad + padBottom
  const radius = (frame.radius ?? 0.012) * width

  ctx.save()
  if (frame.shadow !== false) {
    ctx.shadowColor = 'rgba(30,20,10,0.28)'
    ctx.shadowBlur = width * 0.03
    ctx.shadowOffsetY = width * 0.008
  }
  ctx.fillStyle = frame.color || '#FFFFFF'
  roundRectPath(ctx, -fw / 2, -h / 2 - pad, fw, fh, radius)
  ctx.fill()
  ctx.restore()
}

/**
 * Draw a whole collage.
 *
 * @param ctx     2D context sized to width × height
 * @param doc     collage document ({ templateId, background, border, slots })
 * @param images  Map<url, HTMLImageElement|ImageBitmap> — see loadSlotImages
 * @param opts    { width, height, placeholders } — placeholders paints empty
 *                slots as translucent blocks (preview), off for exports.
 */
export function drawCollage(ctx, doc, images, { width, height, placeholders = false } = {}) {
  const template = getTemplate(doc?.templateId)
  const border = { ...DEFAULT_BORDER, ...(doc?.border || {}) }
  const decorations = template.decorations || []

  ctx.clearRect(0, 0, width, height)
  // A background the customer picked in the Borders tab wins; otherwise the
  // template's own colour or gradient.
  paintBackground(ctx, doc?.background || template.background, width, height)

  for (const decoration of decorations) {
    if (decoration.layer === 'front') continue
    paintDecoration(ctx, decoration, { width, height })
  }

  template.slots.forEach((slot, index) => {
    const fill = doc?.slots?.find((s) => s.id === slot.id) || doc?.slots?.[index] || {}
    const { w, h, cx, cy } = slotRect(slot, width, height, border.gap)
    const img = fill.url ? images?.get?.(fill.url) : null

    ctx.save()
    if (slot.rotation && slot.pivot) {
      // Rotate around a shared pivot — a photo lying on a tilted film strip has
      // to turn about the strip's centre, not its own, or it slides off the
      // sprockets as the angle grows.
      const px = slot.pivot[0] * width
      const py = slot.pivot[1] * height
      ctx.translate(px, py)
      ctx.rotate((slot.rotation * Math.PI) / 180)
      ctx.translate(cx - px, cy - py)
    } else {
      ctx.translate(cx, cy)
      if (slot.rotation) ctx.rotate((slot.rotation * Math.PI) / 180)
    }

    if (slot.frame) paintFrame(ctx, slot.frame, w, h, width)

    slotPath(ctx, w, h, slot.shape, slot.radius ?? border.radius)
    ctx.save()
    ctx.clip()
    if (img) {
      ctx.translate(-w / 2, -h / 2)
      drawImageCovered(ctx, img, w, h, fill.imageScale, fill.flipped, fill.offsetX, fill.offsetY)
    } else if (placeholders) {
      // Empty slots read as a soft window on the artwork rather than a hole.
      ctx.fillStyle = slot.frame ? 'rgba(45,27,14,0.10)' : 'rgba(255,255,255,0.45)'
      ctx.fillRect(-w / 2, -h / 2, w, h)
    }
    ctx.restore()

    // The template's own outline (gold trim, coloured keyline), then the
    // customer's border from the Borders tab on top of it.
    if (slot.stroke?.width > 0) {
      ctx.lineWidth = slot.stroke.width * width
      ctx.strokeStyle = slot.stroke.color || '#FFFFFF'
      ctx.stroke()
    }
    if (border.width > 0) {
      ctx.lineWidth = border.width * width
      ctx.strokeStyle = border.color || DEFAULT_BORDER.color
      ctx.stroke()
    }
    ctx.restore()
  })

  for (const decoration of decorations) {
    if (decoration.layer !== 'front') continue
    paintDecoration(ctx, decoration, { width, height })
  }
}

/**
 * Resolve every photo a collage references into a drawable image, decrypting
 * as needed. Decrypted media arrives as blob: URLs, so the canvas is never
 * tainted and toBlob()/toDataURL() keep working.
 */
export async function loadSlotImages(doc, encryptionKey, { preferThumbs = false } = {}) {
  const urls = [...new Set((doc?.slots || []).map((s) => (preferThumbs && s.thumbUrl) || s.url).filter(Boolean))]
  const entries = await Promise.all(urls.map(async (url) => {
    try {
      const resolved = (await prefetchDecryptedMedia(url, encryptionKey, 'image/*')) || url
      const img = await loadImage(resolved)
      return [url, img]
    } catch {
      // A single unreadable photo must not blank the whole collage; its slot
      // simply renders empty.
      return null
    }
  }))
  return new Map(entries.filter(Boolean))
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = src
  })
}

/**
 * Render a collage to an image Blob at `width` pixels wide.
 */
export async function renderCollageToBlob(doc, images, { width = 1600, type = 'image/jpeg', quality = 0.92 } = {}) {
  const template = getTemplate(doc?.templateId)
  const size = templateSize({ ...template, aspect: doc?.aspect || template.aspect }, width)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  drawCollage(ctx, doc, images, { width: size.width, height: size.height })

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Collage export failed'))),
      type,
      quality
    )
  })
}

/**
 * Convenience for the gallery and the share flow: decrypt, draw, hand back a Blob.
 */
export async function exportCollage(doc, encryptionKey, options) {
  const images = await loadSlotImages(doc, encryptionKey)
  return renderCollageToBlob(doc, images, options)
}
