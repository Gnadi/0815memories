/**
 * `focus` is a positional companion to a moment's `images`, on the same terms
 * as `thumbs` (utils/mediaThumbs.js): focus[i] says which part of images[i]
 * stays in view when a frame of another shape crops it, and how far it is
 * zoomed in. Each entry is "x y" or "x y zoom": the first two are percentages
 * (0–100) from the photo's left and top edge — the point CSS `object-position`
 * keeps in view — and the zoom a factor from 1 (the default) to 3, applied
 * around that same point so it never leaves the frame. '' is the default,
 * the centre at 1×.
 *
 * Anything that does not line up with the images, or does not parse, is
 * ignored, which lands on the centre crop from before the field existed. The
 * value ends up in a style attribute, so only numbers are ever let through.
 */

export const CENTER_FOCUS = { x: 50, y: 50, zoom: 1 }
export const MAX_ZOOM = 3

const NUMBER = '\\d{1,3}(?:\\.\\d+)?'
const FOCUS = new RegExp(`^(${NUMBER}) (${NUMBER})(?: (${NUMBER}))?$`)

/** "x y [zoom]" → { x, y, zoom }, or null for '' and anything malformed. */
export function parseFocus(value) {
  const match = typeof value === 'string' ? FOCUS.exec(value) : null
  if (!match) return null
  return {
    x: Math.min(100, Number(match[1])),
    y: Math.min(100, Number(match[2])),
    zoom: Math.min(MAX_ZOOM, Math.max(1, Number(match[3] ?? 1))),
  }
}

/** { x, y, zoom } → the stored string, or '' for the default. */
export function formatFocus({ x, y, zoom = 1 }) {
  const round = (n) => Math.round(Math.min(100, Math.max(0, n)))
  const [fx, fy] = [round(x), round(y)]
  const fz = Math.round(Math.min(MAX_ZOOM, Math.max(1, zoom)) * 10) / 10
  if (fx === CENTER_FOCUS.x && fy === CENTER_FOCUS.y && fz === 1) return ''
  return fz === 1 ? `${fx} ${fy}` : `${fx} ${fy} ${fz}`
}

/** The style that shows a photo as its focus says, or undefined for the default. */
export function focusStyle(point) {
  if (!point) return undefined
  const style = { objectPosition: `${point.x}% ${point.y}%` }
  if (point.zoom > 1) {
    // object-position pins the focus point to the same spot of the frame, so
    // scaling around that spot keeps it in view at any zoom.
    style.transform = `scale(${point.zoom})`
    style.transformOrigin = `${point.x}% ${point.y}%`
  }
  return style
}

/** The style for images[index] of a document, or undefined for the default. */
export function focusStyleAt(doc, index = 0) {
  const images = Array.isArray(doc?.images) ? doc.images : []
  const focus = Array.isArray(doc?.focus) ? doc.focus : []
  if (images.length === 0 || focus.length !== images.length) return undefined
  return focusStyle(parseFocus(focus[index]))
}

/**
 * The `focus` array to persist next to a freshly assembled image list. Null
 * when every photo is centred, unless `force` — an edit has to overwrite the
 * old array, or a stale one would outlive a photo that was reset or moved.
 */
export function buildFocus(images, force = false) {
  const focus = images.map((img) => img?.focus || '')
  return force || focus.some(Boolean) ? focus : null
}
