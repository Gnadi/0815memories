import { MAX_PLAINTEXT_BYTES } from '../constants/media'
import { decodeImage, encodeCanvas } from './imageThumbnail'

// Recent phones take 24, 48 or 200 MP photos, and iOS hands a HEIC photo to the
// browser as a JPEG, so one photo can come to 10–40 MB: over Cloudinary's raw
// cap, and a large bite of the family's storage for detail no screen shows.
// Photos larger than this are scaled down before they are encrypted. 4096 px
// still prints a full A4 page of a photo book at 300 dpi (about 3500 px), and
// 4096² is exactly the largest canvas iOS Safari will draw (16.7 MP).
//
// Everything at or under it, which includes the 12 MP photos most phones take,
// is uploaded as it was picked: the original is what the archive keeps, and the
// feed already reads the 1024 px thumbnail.
export const MAX_PHOTO_EDGE = 4096

// A photo this small cannot be large enough to be worth a look; it is not even
// decoded. Photos of more than 4096 px come out well above it.
const SMALL_PHOTO_BYTES = 3 * 1024 * 1024

// Visually lossless for photos; the lower steps are only for a photo that
// would otherwise be refused for its size.
const QUALITIES = [0.9, 0.82, 0.75]

// Animation and vectors would be flattened into one still frame.
const KEEP_AS_IS = new Set(['image/gif', 'image/svg+xml'])

// JPEG has no transparency, so formats that can carry it become WebP. A browser
// that cannot encode WebP (Safari) hands back a PNG instead, which still keeps
// the transparency, if not as small.
function outputTypeFor(type) {
  return type === 'image/png' || type === 'image/webp' ? 'image/webp' : 'image/jpeg'
}

function scaledSize(width, height) {
  const longest = Math.max(width, height)
  if (longest <= MAX_PHOTO_EDGE) return { width, height }
  const scale = MAX_PHOTO_EDGE / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/**
 * Returns `blob` itself when it is not a photo, is small, or cannot be read
 * here; otherwise a copy at most MAX_PHOTO_EDGE on its longest side and under
 * `limit`. Never throws: whatever comes back goes through the upload's own size
 * check, which reports a photo that still does not fit.
 *
 * The copy carries no EXIF. Its rotation is applied to the pixels, and the app
 * reads nothing else from it; capture time and place go with it, which a
 * re-encode cannot avoid.
 */
export async function fitImageToLimit(blob, { limit = MAX_PLAINTEXT_BYTES } = {}) {
  if (!blob || typeof blob.type !== 'string' || !blob.type.startsWith('image/')) return blob
  if (KEEP_AS_IS.has(blob.type)) return blob
  if (blob.size <= SMALL_PHOTO_BYTES && blob.size <= limit) return blob

  const bitmap = await decodeImage(blob)
  // HEIC outside Safari, for one. The upload refuses it if it is too large.
  if (!bitmap) return blob

  try {
    const fits = blob.size <= limit
    if (fits && Math.max(bitmap.width, bitmap.height) <= MAX_PHOTO_EDGE) return blob

    const size = scaledSize(bitmap.width, bitmap.height)
    const canvas = typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(size.width, size.height)
      : Object.assign(document.createElement('canvas'), size)
    const ctx = canvas.getContext('2d')
    if (!ctx) return blob
    ctx.drawImage(bitmap, 0, 0, size.width, size.height)

    const type = outputTypeFor(blob.type)
    for (const quality of QUALITIES) {
      const out = await encodeCanvas(canvas, type, quality)
      if (!out) break
      // A copy that came out larger than a photo which already fitted is no
      // gain, so the original stays.
      if (fits && out.size >= blob.size) return blob
      if (out.size <= limit) return out
      // A PNG fallback ignores quality; trying again changes nothing.
      if (out.type !== type) break
    }
    return blob
  } catch {
    return blob
  } finally {
    bitmap.close?.()
  }
}
