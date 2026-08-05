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
  } = options

  if (!file || typeof file.type !== 'string' || !file.type.startsWith('image/')) return null
  if (file.size <= MIN_SOURCE_BYTES) return null
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
    if (!size) return null

    const canvas = typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(size.width, size.height)
      : Object.assign(document.createElement('canvas'), size)

    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, size.width, size.height)

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
