// How a scrapbook photo sits inside its frame: zoom, pan and "show the whole
// photo". The editor's <img> and the PDF export's <canvas> both go through
// computeCoverRect, so what is framed on screen is what lands in the PDF.

import { computeCoverRect } from '../../utils/collageRenderer'

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

/**
 * The zoom at which the whole photo fits inside the frame (letterboxed), in
 * the units of computeCoverRect: 1 is the cover crop, below 1 zooms out.
 */
export function containScale(imgW, imgH, boxW, boxH) {
  if (!imgW || !imgH || !boxW || !boxH) return 1
  const ratio = (imgW / imgH) / (boxW / boxH)
  return Math.min(ratio, 1 / ratio)
}

/** The zoom the photo is actually drawn at — `fit: 'contain'` wins over imageScale. */
export function effectiveScale(element, imgW, imgH, boxW, boxH) {
  if (element?.fit === 'contain') return containScale(imgW, imgH, boxW, boxH)
  return element?.imageScale || 1
}

/**
 * Where to put a full-size <img> so the frame shows exactly the source
 * rectangle computeCoverRect picks: its size and offset in frame pixels.
 */
export function imageLayout(imgW, imgH, boxW, boxH, scale = 1, offsetX = 0, offsetY = 0) {
  const { sx, sy, sw } = computeCoverRect(imgW, imgH, boxW, boxH, scale, offsetX, offsetY)
  if (!sw) return null
  const k = boxW / sw
  return { left: -sx * k, top: -sy * k, width: imgW * k, height: imgH * k }
}

/**
 * New pan offsets after the photo was dragged by (dx, dy) frame pixels, so the
 * picture follows the finger. Offsets stay within −1 … 1; an axis with no room
 * to pan (the photo is not larger than the frame that way) stays where it is.
 */
export function panBy(element, imgW, imgH, boxW, boxH, dx, dy) {
  const scale = effectiveScale(element, imgW, imgH, boxW, boxH)
  const { sw, sh } = computeCoverRect(imgW, imgH, boxW, boxH, scale, 0, 0)
  const roomX = (imgW - sw) / 2
  const roomY = (imgH - sh) / 2
  // A mirrored photo is mirrored after cropping, so dragging right has to move
  // the crop the other way to keep the picture under the finger.
  const dirX = element?.flipped ? -1 : 1
  const offsetX = element?.offsetX || 0
  const offsetY = element?.offsetY || 0
  return {
    offsetX: roomX > 0 ? clamp(offsetX - dirX * dx * (sw / boxW) / roomX, -1, 1) : offsetX,
    offsetY: roomY > 0 ? clamp(offsetY - dy * (sh / boxH) / roomY, -1, 1) : offsetY,
  }
}
