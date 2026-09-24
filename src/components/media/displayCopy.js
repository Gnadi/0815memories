import { createThumbnail } from '../../utils/imageThumbnail'
import {
  getDecryptedBlob,
  peekDecryptedMedia,
  putDerivedMedia,
} from './useDecryptedMedia'

/**
 * A copy of a full-size original at the size it is actually shown.
 *
 * A phone photo is 12 to 50 megapixels; decoded, that is 50 to 200 MB of
 * bitmap for a screen of about three. A phone's browser cannot always keep a
 * bitmap that size ready: it paints it late, or drops it under memory pressure
 * and paints it again, and until it has, that spot of the story shows the dark
 * background. That was the "blink" on large photos. The story viewer shows this
 * copy instead — as sharp on the screen as the original, a fraction of the
 * memory.
 *
 * The copy lives in the decrypted-media cache under its own key, so the same
 * budget, pinning and logout clearing apply to it as to everything else.
 */

// A rounding step for the target, so a few pixels of difference in the frame
// reuse one copy instead of making another.
const STEP = 128
// Nothing here needs more, and some phones cannot hold a texture larger.
const MAX_EDGE = 4096
const QUALITY = 0.9

// encrypted original -> the cache key of what to show for it: its display copy,
// or the original itself when a copy would not help.
const chosen = new Map()
const pending = new Map()

/** The cache key last chosen for this original, or null. Safe during render. */
export function displayCopyKey(src) {
  return chosen.get(src) ?? null
}

/** The frame an element takes up, in device pixels, rounded up to STEP. */
export function frameOf(element) {
  const rect = element?.getBoundingClientRect?.()
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
  const width = rect?.width || (typeof window !== 'undefined' ? window.innerWidth : 0)
  const height = rect?.height || (typeof window !== 'undefined' ? window.innerHeight : 0)
  const round = (n) => Math.min(MAX_EDGE, Math.max(STEP, Math.ceil((n * dpr) / STEP) * STEP))
  return { width: round(width), height: round(height) }
}

/**
 * The longest edge a width × height photo needs to cover `frame` the way
 * object-cover shows it: scaled until both sides reach the frame, and no more.
 */
export function coverEdge(width, height, frame) {
  const scale = Math.max(frame.width / width, frame.height / height)
  return Math.min(MAX_EDGE, Math.ceil(Math.max(width, height) * scale))
}

/**
 * Make (or find) the display copy of an already-decrypted original. Resolves to
 * the cache key to show — the copy's, or `src` itself when the original is small
 * enough already, cannot be redrawn (an animated GIF would lose its motion), or
 * the browser lacks the APIs — and null when the original is not decrypted.
 */
export function fitForDisplay(src, frame) {
  const key = `${src}#display=${frame.width}x${frame.height}`
  if (peekDecryptedMedia(key)) {
    chosen.set(src, key)
    return Promise.resolve(key)
  }
  if (pending.has(key)) return pending.get(key)

  const blob = getDecryptedBlob(src)
  if (!blob) return Promise.resolve(null)

  const job = (async () => {
    let copy = null
    if (blob.type !== 'image/gif') {
      copy = await createThumbnail(blob, {
        maxEdge: (width, height) => coverEdge(width, height, frame),
        // PNG keeps what a screenshot needs (transparency, sharp text); a photo
        // is far smaller as JPEG.
        type: blob.type === 'image/png' ? 'image/png' : 'image/jpeg',
        quality: QUALITY,
        minSourceBytes: 0,
      }).catch(() => null)
    }
    const chosenKey = copy ? (putDerivedMedia(key, copy), key) : src
    chosen.set(src, chosenKey)
    return chosenKey
  })().finally(() => pending.delete(key))

  pending.set(key, job)
  return job
}
