/**
 * `focus` is a positional companion to a moment's `images`, on the same terms
 * as `thumbs` (utils/mediaThumbs.js): focus[i] says which part of images[i]
 * stays in view when a frame of another shape crops it. Each entry is "x y",
 * the two numbers being percentages (0–100) from the photo's left and top edge
 * — the point CSS `object-position` keeps in view — or '' for the default,
 * the centre.
 *
 * Anything that does not line up with the images, or does not parse, is
 * ignored, which lands on the centre crop from before the field existed. The
 * value ends up in a style attribute, so only numbers are ever let through.
 */

export const CENTER_FOCUS = { x: 50, y: 50 }

const FOCUS = /^(\d{1,3}(?:\.\d+)?) (\d{1,3}(?:\.\d+)?)$/

/** "x y" → { x, y } clamped to 0–100, or null for '' and anything malformed. */
export function parseFocus(value) {
  const match = typeof value === 'string' ? FOCUS.exec(value) : null
  if (!match) return null
  return { x: Math.min(100, Number(match[1])), y: Math.min(100, Number(match[2])) }
}

/** { x, y } → the stored "x y", or '' for the centre. */
export function formatFocus({ x, y }) {
  const round = (n) => Math.round(Math.min(100, Math.max(0, n)))
  const [fx, fy] = [round(x), round(y)]
  return fx === CENTER_FOCUS.x && fy === CENTER_FOCUS.y ? '' : `${fx} ${fy}`
}

/** The CSS object-position for images[index], or undefined for the default. */
export function objectPositionAt(doc, index = 0) {
  const images = Array.isArray(doc?.images) ? doc.images : []
  const focus = Array.isArray(doc?.focus) ? doc.focus : []
  if (images.length === 0 || focus.length !== images.length) return undefined
  const point = parseFocus(focus[index])
  return point ? `${point.x}% ${point.y}%` : undefined
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
