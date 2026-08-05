import { useEffect } from 'react'
import { doc, runTransaction } from 'firebase/firestore'
import { db } from '../config/firebase'
import { createThumbnail } from '../utils/imageThumbnail'
import { encryptAndUpload } from '../utils/encryptedUpload'
import { prefetchDecryptedMedia } from '../components/media/useDecryptedMedia'
import { needsThumbs } from '../utils/mediaThumbs'
import { devError } from '../utils/devLog'

// Kill switch: flip to false to stop all backfill writes without a rollback.
const BACKFILL_ENABLED = true

// Deliberately small. This is opportunistic maintenance, not a migration —
// browsing the app a handful of times works through a family's back catalogue
// on its own, and a bad day costs three documents, not the collection.
const MAX_DOCS_PER_SESSION = 3

let processedThisSession = 0
let running = false
const inProgress = new Set()

async function blobFromObjectUrl(objectUrl) {
  const response = await fetch(objectUrl)
  return response.blob()
}

/**
 * Produce the `thumbs` array for one document, reusing whatever the media
 * cache already holds so a photo the feed just displayed costs no new download.
 * Returns null when not a single image yielded a thumbnail worth uploading.
 */
async function buildThumbsForDoc(images, encryptionKey) {
  const thumbs = []
  let any = false

  for (const imageUrl of images) {
    try {
      const objectUrl = await prefetchDecryptedMedia(imageUrl, encryptionKey, 'image/*')
      if (!objectUrl) {
        thumbs.push('')
        continue
      }
      const original = await blobFromObjectUrl(objectUrl)
      const thumbBlob = await createThumbnail(original)
      if (!thumbBlob) {
        // Already small enough, or not a still image. Recording '' marks it as
        // considered so we stop revisiting this document.
        thumbs.push('')
        continue
      }
      const { url } = await encryptAndUpload(thumbBlob, encryptionKey)
      thumbs.push(url)
      any = true
    } catch (err) {
      devError('Thumbnail backfill failed for an image:', err)
      thumbs.push('')
    }
  }

  return any ? thumbs : null
}

/**
 * Write `thumbs` only, and only if `images` is byte-for-byte what we based the
 * thumbnails on. An admin editing the same memory in another tab wins; we
 * abandon our work rather than persist an array that points at the wrong
 * photos. No other field is read for the write or touched by it.
 */
async function commitThumbs(collectionName, docId, expectedImages, thumbs) {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, collectionName, docId)
    const snap = await tx.get(ref)
    if (!snap.exists()) return

    const current = snap.data()
    const images = Array.isArray(current.images) ? current.images : []
    if (images.length !== expectedImages.length) return
    if (images.some((url, i) => url !== expectedImages[i])) return
    // Someone already filled this in.
    if (Array.isArray(current.thumbs) && current.thumbs.length === images.length) return

    tx.update(ref, { thumbs })
  })
}

const idle = (fn) =>
  typeof requestIdleCallback === 'function'
    ? requestIdleCallback(fn, { timeout: 4000 })
    : setTimeout(fn, 1200)

/**
 * Opportunistically give pre-existing documents the downscaled copies that new
 * uploads get for free. Additive only — see commitThumbs.
 *
 * @param {string} collectionName  'memories' or 'moments'
 * @param {Array}  docs            decrypted documents currently on screen
 * @param {{ enabled: boolean, encryptionKey: CryptoKey|null }} options
 */
export function useThumbnailBackfill(collectionName, docs, { enabled, encryptionKey }) {
  useEffect(() => {
    if (!BACKFILL_ENABLED) return
    // Admin-gated by the caller: viewers have no write access and must never
    // be asked to re-upload a family's media.
    if (!enabled || !encryptionKey || !db) return
    if (processedThisSession >= MAX_DOCS_PER_SESSION) return

    let cancelled = false

    const handle = idle(async () => {
      // Firestore re-emits often and hands back fresh arrays each time, so this
      // effect re-runs a lot. One pass at a time across all callers.
      if (running) return
      running = true
      try {
        for (const item of docs) {
          // Only stop *starting* new documents on unmount. A document already
          // under way runs to its commit — abandoning it after the thumbnails
          // were uploaded would leave orphaned assets on Cloudinary.
          if (cancelled) return
          if (processedThisSession >= MAX_DOCS_PER_SESSION) return
          if (!item?.id || !needsThumbs(item) || inProgress.has(item.id)) continue

          inProgress.add(item.id)
          // Count on attempt, not on success: a document that fails repeatedly
          // must not be able to monopolise the session budget.
          processedThisSession++
          try {
            const images = [...item.images]
            const thumbs = await buildThumbsForDoc(images, encryptionKey)
            if (!thumbs) continue
            await commitThumbs(collectionName, item.id, images, thumbs)
          } catch (err) {
            devError('Thumbnail backfill failed:', err)
          } finally {
            inProgress.delete(item.id)
          }
        }
      } finally {
        running = false
      }
    })

    return () => {
      cancelled = true
      if (typeof cancelIdleCallback === 'function') cancelIdleCallback(handle)
      else clearTimeout(handle)
    }
  }, [collectionName, docs, enabled, encryptionKey])
}
