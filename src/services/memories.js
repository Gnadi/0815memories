/**
 * Memories: the feed's entries with a story. Their text is encrypted; the
 * moments next to them (services/moments.js) keep theirs in clear.
 */
import {
  addDoc,
  collection,
  doc,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from '../config/firestore'
import { auth, db } from '../config/firebase'
import { decryptFields, decryptStringArray, encryptFields } from '../utils/encryption'
import { parseRichDoc } from '../utils/richText'
import { getFamilyDocument, subscribeDecrypted } from './decrypted'

const MEMORIES = 'memories'
const MOMENTS = 'moments'

/**
 * Text fields every reader needs. The feed decrypts exactly these.
 */
export const MEMORY_TEXT_FIELDS = ['title', 'content', 'quote', 'location', 'authorName', 'category']

/**
 * What a write encrypts: the text fields plus `contentRich`, the rich
 * description document.
 *
 * `contentRich` is deliberately a JSON *string* by the time it reaches here, so
 * it rides the ordinary encryptFields() path. That matters: encryptFields skips
 * any value that is not a string, silently — an object would land in Firestore
 * as a readable map, unencrypted. Keeping the field on this list, as a string,
 * means there is no second code path to forget. firestore.rules rejects a
 * non-string `contentRich` as a server-side backstop.
 */
export const MEMORY_WRITE_FIELDS = [...MEMORY_TEXT_FIELDS, 'contentRich']

/**
 * Feed decryption — text fields only.
 *
 * `contentRich` is left as ciphertext on purpose: this runs for up to 50
 * documents on every snapshot, no feed surface reads the rich document, and
 * readers fall back to the `content` plain-text mirror when it is not a parsed
 * document.
 */
export async function decryptMemory(key, data) {
  if (!key) return data
  const result = await decryptFields(key, data, MEMORY_TEXT_FIELDS)
  // The blur-up previews, which is the one thing here worth paying for on every
  // snapshot: ~700 bytes each, measured at 0.19ms, so fifty of them cost about
  // 10ms and replace fifty spinners with the photos' own colours. They are the
  // reason this decrypt happens at all — there is nothing to fetch.
  if (Array.isArray(result.thumbsTiny)) {
    result.thumbsTiny = await decryptStringArray(key, result.thumbsTiny)
  }
  return result
}

/**
 * Single-document read (detail page, edit form, export): decrypt everything and
 * parse the rich description. Idempotent, so passing an already-decrypted
 * memory back through is harmless.
 */
export async function decryptMemoryDoc(key, data) {
  if (!key) return data
  const result = await decryptFields(key, data, MEMORY_WRITE_FIELDS)
  if (result.contentRich != null) result.contentRich = parseRichDoc(result.contentRich)
  return result
}

/**
 * The single encryption entry point for a memory's text: every write of it in
 * the app goes through here.
 */
export async function encryptMemoryData(key, data) {
  // Fail loudly rather than write a readable map. encryptFields would skip a
  // non-string silently, and nothing downstream would look broken.
  if (data?.contentRich != null && typeof data.contentRich !== 'string') {
    throw new Error('contentRich must be a JSON string before encryption')
  }
  return encryptFields(key, data, MEMORY_WRITE_FIELDS)
}

/** The family's latest memories, newest first, decrypted for the feed. */
export function subscribeMemories(familyId, key, { pageSize }, onData, onError) {
  return subscribeDecrypted(
    query(collection(db, MEMORIES), where('familyId', '==', familyId), orderBy('date', 'desc'), limit(pageSize)),
    (docs) => Promise.all(docs.map((d) => decryptMemory(key, d))),
    onData,
    onError,
  )
}

/** One memory, decrypted in full. */
export function getMemory(familyId, key, id) {
  return getFamilyDocument(MEMORIES, id, familyId, (data) => decryptMemoryDoc(key, data))
}

// Plaintext on purpose: notifyOnMemory uses it to leave the author's own device
// alone. The push itself is composed server-side — the title is ciphertext by
// the time it is written, and sending it would have undone the encryption for
// anyone reading the lock screen.
const createdByUid = () => auth?.currentUser?.uid || null

export async function addMemory(familyId, key, memory) {
  const encrypted = await encryptMemoryData(key, memory)
  await addDoc(collection(db, MEMORIES), {
    ...encrypted,
    familyId,
    createdByUid: createdByUid(),
    createdAt: serverTimestamp(),
  })
}

export async function updateMemory(key, id, updates) {
  const encrypted = await encryptMemoryData(key, updates)
  await updateDoc(doc(db, MEMORIES, id), encrypted)
}

// Turning a memory into a moment and back. The two live in separate
// collections, so a conversion is a create in one and a delete in the other, in
// one batch so a failure never leaves the entry in both places or in neither.
//
// The media is reused as-is: both collections store the same encrypted uploads
// under the same family key. Only the text differs — memories encrypt theirs,
// moments keep it in clear — so each side goes through its own write path.

export async function convertMemoryToMoment(familyId, memoryId, moment, date) {
  const batch = writeBatch(db)
  const momentRef = doc(collection(db, MOMENTS))
  batch.set(momentRef, {
    ...moment,
    familyId,
    createdByUid: createdByUid(),
    // Keep the memory's own date so it lands where it happened, not as today.
    date: date || serverTimestamp(),
  })
  batch.delete(doc(db, MEMORIES, memoryId))
  await batch.commit()
  return momentRef.id
}

export async function convertMomentToMemory(familyId, key, momentId, memory) {
  const encrypted = await encryptMemoryData(key, memory)
  const batch = writeBatch(db)
  const memoryRef = doc(collection(db, MEMORIES))
  batch.set(memoryRef, {
    ...encrypted,
    familyId,
    createdByUid: createdByUid(),
    createdAt: serverTimestamp(),
  })
  batch.delete(doc(db, MOMENTS, momentId))
  await batch.commit()
  return memoryRef.id
}
