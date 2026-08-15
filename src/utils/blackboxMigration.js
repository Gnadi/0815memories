import {
  collection,
  deleteField,
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
import { decryptText, encryptText } from './encryption'
import { devError } from './devLog'

/**
 * Bring old Black Box capsules up to the shape the current code expects. Two
 * repairs, both derived from the data rather than tracked:
 *
 * 1. **Encrypt them.** `useBlackBox` declared its encrypted fields as
 *    ['content'], but the create page writes 'message' — and encryptFields skips
 *    a field that is not present. So every capsule sealed before that fix holds
 *    its title and message as plaintext, in the one collection where that
 *    matters most.
 *
 * 2. **Move the letter out of reach.** A capsule is now two documents: metadata
 *    an admin may always read, and a `blackboxContent` document Firestore
 *    withholds until the unlock date. Pre-split capsules keep their payload
 *    inline on the metadata document, where the seal cannot reach it.
 *
 * Both have to run from a signed-in admin's browser: the family key lives only
 * in that session (AuthContext), so there is no server-side path. And both have
 * to run while the metadata document is still readable — a capsule nobody can
 * read is a capsule nobody can repair. That is why the metadata read rule keeps
 * no time condition.
 *
 * Modelled on utils/thumbnailMigration.js, including the property that makes
 * that one resumable: nothing records how far a run got. A rescan re-derives the
 * remaining work, because a field that decrypts is a field already done, and a
 * capsule with no inline payload is a capsule already split.
 */

// The metadata fields that should be ciphertext. Kept here rather than imported
// so the migration describes the shape it is repairing, not the shape today's
// code happens to write.
const ENCRYPTABLE_FIELDS = ['title', 'message']

// The payload that belongs on the content document. `message` appears in both
// lists: on a pre-split capsule it must be encrypted *and* moved.
const PAYLOAD_FIELDS = ['message', 'photos', 'videos', 'voiceNote']

const SCAN_PAGE_SIZE = 100

/**
 * Is this value still plaintext?
 *
 * decryptText returns its input unchanged when it cannot decrypt — the
 * documented behaviour for pre-encryption data (see encryption.js). So a value
 * that comes back identical was never ciphertext. A real ciphertext decrypting
 * to exactly itself would need an AES-GCM collision, which is not a case worth
 * coding around.
 */
async function isPlaintext(encryptionKey, value) {
  if (typeof value !== 'string' || value === '') return false
  return (await decryptText(encryptionKey, value)) === value
}

/** Does this capsule still carry its payload on the metadata document? */
function hasInlinePayload(data) {
  return PAYLOAD_FIELDS.some((field) => data[field] != null)
}

/**
 * Find every capsule needing either repair.
 *
 * @returns {Promise<{ total: number, pending: Array<{
 *            id: string,
 *            familyId: string,
 *            plain: Record<string,string>,
 *            payload: Record<string,unknown>|null,
 *          }> }>}
 *          `plain` maps each plaintext field to the exact value read, which the
 *          commit uses to detect a concurrent edit. `payload` is the inline
 *          content to move across, or null when the capsule is already split.
 */
export async function scanBlackboxEncryption(familyId, encryptionKey) {
  if (!familyId || !encryptionKey || !db) return { total: 0, pending: [] }

  let total = 0
  const pending = []
  let cursor = null

  // Paged, and ordered by createdAt because that is the ordering the existing
  // blackbox composite index already covers.
  for (;;) {
    const constraints = [
      where('familyId', '==', familyId),
      orderBy('createdAt', 'desc'),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(SCAN_PAGE_SIZE),
    ]
    const snapshot = await getDocs(query(collection(db, 'blackbox'), ...constraints))
    if (snapshot.empty) break

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data()
      total++

      const plain = {}
      for (const field of ENCRYPTABLE_FIELDS) {
        if (await isPlaintext(encryptionKey, data[field])) plain[field] = data[field]
      }

      const inline = hasInlinePayload(data)
      if (Object.keys(plain).length === 0 && !inline) continue

      // The payload is captured as it will be written to the content document:
      // decrypted here, re-encrypted at commit, so a half-encrypted pre-split
      // capsule ends up consistent either way.
      let payload = null
      if (inline) {
        const decrypted = await decryptText(encryptionKey, data.message ?? '')
        payload = {
          message: decrypted,
          photos: data.photos ?? [],
          videos: data.videos ?? [],
          voiceNote: data.voiceNote ?? null,
        }
      }

      pending.push({ id: docSnap.id, familyId: data.familyId, plain, payload })
    }

    if (snapshot.size < SCAN_PAGE_SIZE) break
    cursor = snapshot.docs[snapshot.docs.length - 1]
  }

  return { total, pending }
}

/**
 * Repair one capsule: encrypt what is plaintext, move the letter to its own
 * document, and clear the inline copy.
 *
 * All of it in one transaction, because the intermediate states are the
 * dangerous ones. Writing the content document first and failing before the
 * delete leaves the letter readable in two places, one of them unsealed;
 * clearing first and failing leaves no letter at all.
 *
 * The write is discarded if any field moved under us — including the case where
 * another tab ran this migration first.
 *
 * @returns {Promise<boolean>} whether the write went through
 */
export async function migrateBlackboxDocument(item, encryptionKey) {
  const ciphertext = {}
  for (const [field, value] of Object.entries(item.plain)) {
    ciphertext[field] = await encryptText(encryptionKey, value)
  }

  const content = item.payload
    ? {
        ...item.payload,
        message: await encryptText(encryptionKey, item.payload.message ?? ''),
        familyId: item.familyId,
      }
    : null

  let written = false
  await runTransaction(db, async (tx) => {
    written = false
    const ref = doc(db, 'blackbox', item.id)
    const snap = await tx.get(ref)
    if (!snap.exists()) return

    const current = snap.data()
    // Every field must still be the plaintext we encrypted. If any changed,
    // discard the whole write rather than mix eras within one document.
    for (const [field, value] of Object.entries(item.plain)) {
      if (current[field] !== value) return
    }

    const metadataUpdate = { ...ciphertext }

    if (content) {
      // Only move a payload that is still there. If it is gone, another tab
      // already split this capsule and its content document is authoritative.
      if (!hasInlinePayload(current)) return
      tx.set(doc(db, 'blackboxContent', item.id), content)
      for (const field of PAYLOAD_FIELDS) metadataUpdate[field] = deleteField()
    }

    tx.update(ref, metadataUpdate)
    written = true
  })
  return written
}

/**
 * Walk the pending capsules, one at a time.
 *
 * Serial, like the thumbnail migration: progress stays truthful and cancelling
 * is immediate. There is no per-document concurrency to win here — these are
 * short strings, and the cost is the round trip, not the crypto.
 *
 * @param {Array} items from scanBlackboxEncryption().pending
 * @param {CryptoKey} encryptionKey
 * @param {{ onProgress?: (done: number, total: number) => void, shouldStop?: () => boolean }} options
 * @returns {Promise<{ done: number, written: number, stopped: boolean }>}
 */
export async function migrateBlackboxEncryption(items, encryptionKey, { onProgress, shouldStop } = {}) {
  let done = 0
  let written = 0

  for (const item of items) {
    if (shouldStop?.()) return { done, written, stopped: true }

    try {
      if (await migrateBlackboxDocument(item, encryptionKey)) written++
    } catch (err) {
      devError('Black Box encryption migration failed:', err)
    }

    done++
    onProgress?.(done, items.length)
  }

  return { done, written, stopped: false }
}
