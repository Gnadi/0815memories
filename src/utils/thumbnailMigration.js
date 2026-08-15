import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  startAfter,
  where,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { decryptBlob, encryptText } from './encryption'
import { createThumbnail, createTinyPreview } from './imageThumbnail'
import { encryptAndUpload } from './encryptedUpload'
import { needsThumbs, needsTinyPreviews } from './mediaThumbs'
import { devError } from './devLog'

// Collections whose documents carry an `images` array.
export const MIGRATABLE_COLLECTIONS = ['memories', 'moments']

const SCAN_PAGE_SIZE = 100

/**
 * Find every document that still lacks usable thumbnails.
 *
 * Only `images` and `thumbs` are read, and both are plain URL arrays — the scan
 * decrypts nothing, so it stays cheap even on a large library.
 *
 * The result *is* the progress state. Nothing is written to track how far a run
 * got: a rescan re-derives what is left from the data itself, which is what
 * makes the migration resumable across sessions, tabs and devices.
 *
 * @returns {Promise<{ total: number, pending: Array<{ collectionName: string, id: string, images: string[] }> }>}
 */
export async function scanThumbnailStatus(familyId, collections = MIGRATABLE_COLLECTIONS) {
  if (!familyId || !db) return { total: 0, pending: [] }

  let total = 0
  const pending = []

  for (const collectionName of collections) {
    let cursor = null
    // Paged rather than one unbounded read, and ordered by `date` because that
    // is the ordering the app's existing composite indexes already cover.
    for (;;) {
      const constraints = [
        where('familyId', '==', familyId),
        orderBy('date', 'desc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(SCAN_PAGE_SIZE),
      ]
      const snapshot = await getDocs(query(collection(db, collectionName), ...constraints))
      if (snapshot.empty) break

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data()
        if (!Array.isArray(data.images) || data.images.length === 0) continue
        total++
        // Either derivative missing is reason enough to visit the document —
        // both are built from the same decrypted original, so doing them
        // together costs one download instead of two.
        if (needsThumbs(data) || needsTinyPreviews(data)) {
          pending.push({
            collectionName,
            id: docSnap.id,
            images: [...data.images],
            wantThumbs: needsThumbs(data),
            wantTiny: needsTinyPreviews(data),
          })
        }
      }

      if (snapshot.size < SCAN_PAGE_SIZE) break
      cursor = snapshot.docs[snapshot.docs.length - 1]
    }
  }

  return { total, pending }
}

async function decryptOriginal(imageUrl, encryptionKey) {
  const response = await fetch(imageUrl)
  if (!response.ok) throw new Error(`Fetch failed (${response.status})`)
  const buffer = await response.arrayBuffer()
  // Deliberately not going through the shared media cache: pushing hundreds of
  // full-resolution originals through it would evict everything the UI is
  // currently showing.
  return decryptBlob(encryptionKey, buffer, 'image/jpeg')
}

/**
 * Build the `thumbs` array for one document. Positional: entry i belongs to
 * images[i], '' when that image has no thumbnail.
 *
 * An image that yields nothing — already small, not a still image, download
 * failed — records ''. Combined with the all-empty case below that means a
 * document is only ever visited once, instead of being re-downloaded on every
 * future run.
 */
async function buildDerivatives(images, encryptionKey, { wantThumbs, wantTiny }) {
  const results = await Promise.all(
    images.map(async (imageUrl) => {
      let original
      try {
        // One download and one decrypt, feeding both derivatives.
        original = await decryptOriginal(imageUrl, encryptionKey)
      } catch (err) {
        devError('Thumbnail migration could not read an image:', err)
        return { thumb: '', tiny: '' }
      }

      // Separately, so one derivative failing does not cost the other. They
      // share only the download.
      let thumb = ''
      if (wantThumbs) {
        try {
          const thumbBlob = await createThumbnail(original)
          if (thumbBlob) thumb = (await encryptAndUpload(thumbBlob, encryptionKey)).url
        } catch (err) {
          devError('Thumbnail migration failed for an image:', err)
        }
      }

      let tiny = ''
      if (wantTiny) {
        try {
          const dataUrl = await createTinyPreview(original)
          // Encrypted as text and returned to the caller: unlike the thumbnail,
          // this one is stored on the document rather than uploaded.
          if (dataUrl) tiny = await encryptText(encryptionKey, dataUrl)
        } catch (err) {
          devError('Preview migration failed for an image:', err)
        }
      }

      return { thumb, tiny }
    })
  )
  // null, not a row of empty strings, for a derivative that was never attempted
  // — commitThumbs writes only what is actually here. An attempted-but-empty
  // entry still writes '', which is what marks a document as considered so the
  // next scan stops selecting it.
  return {
    thumbs: wantThumbs ? results.map((r) => r.thumb) : null,
    thumbsTiny: wantTiny ? results.map((r) => r.tiny) : null,
  }
}

/**
 * Write `thumbs` and nothing else, and only if `images` is still exactly what
 * the thumbnails were built from. An admin editing the same document elsewhere
 * wins: we discard our work rather than persist an array pointing at the wrong
 * photos. No other field is read for the write or touched by it.
 *
 * @returns {Promise<boolean>} whether the write went through
 */
export async function commitThumbs(collectionName, docId, expectedImages, derivatives) {
  // Back-compat: earlier callers passed the thumbs array directly.
  const { thumbs, thumbsTiny } = Array.isArray(derivatives)
    ? { thumbs: derivatives, thumbsTiny: null }
    : derivatives

  let written = false
  await runTransaction(db, async (tx) => {
    written = false
    const ref = doc(db, collectionName, docId)
    const snap = await tx.get(ref)
    if (!snap.exists()) return

    const current = snap.data()
    const images = Array.isArray(current.images) ? current.images : []
    if (images.length !== expectedImages.length) return
    if (images.some((url, i) => url !== expectedImages[i])) return

    // Write only the fields still missing. Each is checked on its own, so a
    // document that already has one derivative still gets the other.
    const update = {}
    const hasThumbs = Array.isArray(current.thumbs) && current.thumbs.length === images.length
    const hasTiny = Array.isArray(current.thumbsTiny) && current.thumbsTiny.length === images.length
    if (thumbs && !hasThumbs) update.thumbs = thumbs
    if (thumbsTiny && !hasTiny) update.thumbsTiny = thumbsTiny
    if (Object.keys(update).length === 0) return

    tx.update(ref, update)
    written = true
  })
  return written
}

/**
 * Give one document its thumbnails. Returns true when `thumbs` was written.
 *
 * A document whose images all came back empty still gets written — an array of
 * empty strings marks it as considered, so needsThumbs() stops selecting it.
 */
export async function migrateDocument(item, encryptionKey) {
  // Older callers had no flags; treat that as "both", which is what a document
  // selected by the previous scan always needed.
  const derivatives = await buildDerivatives(item.images, encryptionKey, {
    wantThumbs: item.wantThumbs ?? true,
    wantTiny: item.wantTiny ?? true,
  })
  return commitThumbs(item.collectionName, item.id, item.images, derivatives)
}

/**
 * Walk a list of pending documents, one at a time.
 *
 * Serial by design: progress stays truthful, cancelling is immediate, and a
 * phone doing this over mobile data is not asked to hold several
 * full-resolution photos in memory at once. Images *within* a document run in
 * parallel, which is where the useful concurrency is.
 *
 * @param {Array} items          from scanThumbnailStatus().pending
 * @param {CryptoKey} encryptionKey
 * @param {{ onProgress?: (done: number, total: number) => void, shouldStop?: () => boolean }} options
 * @returns {Promise<{ done: number, written: number, stopped: boolean }>}
 */
export async function migrateThumbnails(items, encryptionKey, { onProgress, shouldStop } = {}) {
  let done = 0
  let written = 0

  for (const item of items) {
    // Checked between documents only. A document already under way runs to its
    // commit — stopping after its thumbnails were uploaded would leave
    // orphaned assets on Cloudinary.
    if (shouldStop?.()) return { done, written, stopped: true }

    try {
      if (await migrateDocument(item, encryptionKey)) written++
    } catch (err) {
      devError('Thumbnail migration failed:', err)
    }

    done++
    onProgress?.(done, items.length)
  }

  return { done, written, stopped: false }
}
