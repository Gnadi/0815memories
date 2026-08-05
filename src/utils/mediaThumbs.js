/**
 * `thumbs` is an additive, positional companion to a document's `images`
 * array: thumbs[i] is a downscaled, separately encrypted copy of images[i],
 * or '' when none exists.
 *
 * It is deliberately fail-safe. Existing documents have no `thumbs` at all,
 * and a document edited by an older client (or mid-backfill) could carry one
 * that no longer lines up. Rather than risk showing the wrong photo, anything
 * that does not match the images array exactly is ignored, which lands us on
 * the original — the behaviour from before thumbnails existed.
 *
 * Nothing here ever reads or writes `images`; that field is never touched.
 */

function imagesOf(doc) {
  return Array.isArray(doc?.images) ? doc.images : []
}

/** The usable thumbs for a document, or [] when the field cannot be trusted. */
export function thumbsFor(doc) {
  const images = imagesOf(doc)
  const thumbs = Array.isArray(doc?.thumbs) ? doc.thumbs : []
  if (images.length === 0 || thumbs.length !== images.length) return []
  return thumbs
}

/** Thumbnail URL for images[index], or '' to fall back to the original. */
export function thumbAt(doc, index = 0) {
  return thumbsFor(doc)[index] || ''
}

/** True when the document has images but no usable thumbs — i.e. needs backfill. */
export function needsThumbs(doc) {
  return imagesOf(doc).length > 0 && thumbsFor(doc).length === 0
}

/**
 * Build the `thumbs` array to persist next to a freshly assembled image list.
 * Returns null when no image has a thumbnail, so callers can leave the field
 * off the document entirely rather than writing a row of empty strings.
 */
export function buildThumbs(images) {
  const thumbs = images.map((img) => img?.thumbUrl || '')
  return thumbs.some(Boolean) ? thumbs : null
}
