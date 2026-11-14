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

/**
 * `thumbsTiny` is a second companion array, on exactly the same terms as
 * `thumbs`: positional, additive, and ignored wholesale if it does not line up.
 *
 * Its entries are not URLs. Each is an encrypted `data:image/webp;base64,...`
 * string of a ~20px copy, so the blur-up preview travels inside the document and
 * arrives with the text the feed already decrypts — no request, no round trip.
 * See utils/imageThumbnail.js for why there is no server-side alternative.
 */
export function tinyPreviewsFor(doc) {
  const images = imagesOf(doc)
  const tiny = Array.isArray(doc?.thumbsTiny) ? doc.thumbsTiny : []
  if (images.length === 0 || tiny.length !== images.length) return []
  return tiny
}

/**
 * Preview for images[index], or '' when there is none to trust.
 *
 * Only a `data:` URL comes back. An entry that is still ciphertext is not a
 * preview — it is a read path that forgot to decrypt `thumbsTiny`, or a
 * snapshot that arrived before the family key did. Handing that to an `<img
 * src>` does not fail quietly: the browser resolves it as a *relative* URL and
 * fetches it, which on this SPA means ~1 KB of base64 turned into a request the
 * catch-all rewrite answers with index.html. That is what moments did on every
 * card until useMoments learned to decrypt the field.
 *
 * Checked here rather than at each call site because the call sites cannot tell
 * the difference, and the failure is invisible in the rendered output.
 */
export function tinyPreviewAt(doc, index = 0) {
  const preview = tinyPreviewsFor(doc)[index] || ''
  return preview.startsWith('data:') ? preview : ''
}

/** True when the document has images but no usable previews — needs backfill. */
export function needsTinyPreviews(doc) {
  return imagesOf(doc).length > 0 && tinyPreviewsFor(doc).length === 0
}

/** Build `thumbsTiny` to persist, or null when no image produced one. */
export function buildTinyPreviews(images) {
  const tiny = images.map((img) => img?.tinyPreview || '')
  return tiny.some(Boolean) ? tiny : null
}

/**
 * The `thumbsTiny` part of a write, as an object to spread into it.
 *
 * An edit form holds its existing previews decrypted and cannot write them back
 * (see utils/entryConversion.js), so when no image carries a fresh one the field
 * is normally left off and the stored array stays. That is only safe while the
 * photos are the same ones in the same order: after a reorder the stored array
 * still lines up by length and would put each blur-up under the wrong photo. In
 * that case it is replaced with an empty array, which readers ignore and the
 * backfill rebuilds. `previousUrls` is the stored `images`, or null for a new
 * document.
 */
export function tinyPreviewsUpdate(images, previousUrls) {
  const tiny = buildTinyPreviews(images)
  if (tiny) return { thumbsTiny: tiny }
  if (!Array.isArray(previousUrls)) return {}
  const urls = images.map((img) => img?.url)
  const unchanged = urls.length === previousUrls.length &&
    urls.every((url, i) => url === previousUrls[i])
  return unchanged ? {} : { thumbsTiny: [] }
}
