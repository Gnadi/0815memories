/**
 * Client-side thumbnail generation.
 *
 * Media is stored on Cloudinary as `raw` resources because it is encrypted
 * before it leaves the browser, and Cloudinary cannot transform bytes it
 * cannot read. That makes getThumbnailUrl() in config/cloudinary.js unusable
 * for family media: a 64px story circle downloads and decrypts exactly the
 * same multi-megabyte original as the fullscreen view.
 *
 * So the downscale has to happen here, before encryption, and ship as a second
 * encrypted asset.
 */

// Sized for the largest place a derivative is used: the memory feed card,
// ~400 CSS px on a phone and ~768 on desktop. 1024 keeps that sharp on a
// high-density phone screen while still being a fraction of an original.
// Heroes, lightboxes and the NAS export always load the full-resolution file.
export const THUMBNAIL_MAX_EDGE = 1024
const THUMBNAIL_TYPE = 'image/webp'
const THUMBNAIL_QUALITY = 0.75

// Below this there is nothing worth saving, and re-encoding would likely make
// the file bigger than the original.
const MIN_SOURCE_BYTES = 60 * 1024

// The blur-up preview. Small enough to travel inside the Firestore document as
// base64 ciphertext — a 20px WebP is a few hundred bytes — and stretched over
// the frame with a blur, so a photo appears as its own colours immediately
// rather than as a spinner. 20px is the doc's suggested 16–24 range: below that
// the shapes go; above it the base64 starts to matter across fifty of them.
export const TINY_PREVIEW_MAX_EDGE = 20
const TINY_PREVIEW_QUALITY = 0.6

function targetSize(width, height, maxEdge) {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return null
  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

async function encodeCanvas(canvas, type, quality) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type, quality })
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Downscale an image blob. Returns null when a thumbnail would not help —
 * the file is already small, the format is not a still image, or the browser
 * lacks the APIs. Callers treat null as "just use the original".
 *
 * @param {Blob|File} file
 * @param {{ maxEdge?: number, type?: string, quality?: number }} [options]
 * @returns {Promise<Blob|null>}
 */
export async function createThumbnail(file, options = {}) {
  const {
    maxEdge = THUMBNAIL_MAX_EDGE,
    type = THUMBNAIL_TYPE,
    quality = THUMBNAIL_QUALITY,
    // The tiny preview wants a result for every photo, however small the
    // original, because what it removes is a round trip rather than bytes.
    minSourceBytes = MIN_SOURCE_BYTES,
    allowUpscaleSkip = true,
  } = options

  if (!file || typeof file.type !== 'string' || !file.type.startsWith('image/')) return null
  if (file.size <= minSourceBytes) return null
  if (typeof createImageBitmap !== 'function') return null

  let bitmap
  try {
    // imageOrientation applies the EXIF rotation, so portrait phone photos do
    // not come back sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return null
  }

  try {
    const size = targetSize(bitmap.width, bitmap.height, maxEdge)
    // Already smaller than the target. For a real thumbnail that means there is
    // nothing to do; for the tiny preview it still needs producing, at the
    // source's own size.
    if (!size && allowUpscaleSkip) return null

    const target = size ?? { width: bitmap.width, height: bitmap.height }

    const canvas = typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(target.width, target.height)
      : Object.assign(document.createElement('canvas'), target)

    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, target.width, target.height)

    const blob = await encodeCanvas(canvas, type, quality)
    // A "thumbnail" that grew is not one.
    if (!blob || blob.size >= file.size) return null
    return blob
  } catch {
    return null
  } finally {
    bitmap.close?.()
  }
}

/**
 * A blur-up preview small enough to live inside the Firestore document.
 *
 * Returns a `data:image/webp;base64,...` string rather than a Blob, because that
 * is the shape that survives being encrypted as text and can go straight into an
 * `<img src>` on the way out — no object URL, no fetch, no decrypt round trip.
 * `useDecryptedMedia` already treats a `data:` URL as directly usable.
 *
 * There is no server-side alternative to this: Cloudinary stores these as `raw`
 * because it cannot transform ciphertext, so any preview fetched separately
 * costs a full round trip and defeats the point. This one arrives with the text
 * fields the feed decrypts anyway.
 *
 * @returns {Promise<string|null>} null when a preview cannot be made
 */
export async function createTinyPreview(file) {
  const blob = await createThumbnail(file, {
    maxEdge: TINY_PREVIEW_MAX_EDGE,
    quality: TINY_PREVIEW_QUALITY,
    // Every photo gets one, and a source already under 20px still gets one at
    // its own size.
    minSourceBytes: 0,
    allowUpscaleSkip: false,
  })
  if (!blob) return null

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(blob)
  })
}
