/**
 * Moments: the quick entries next to the memories.
 *
 * Their text — caption, category, location and label — was kept in clear for
 * as long as moments existed, while their photos were encrypted like every
 * other upload. New and edited moments encrypt it, and say so with
 * `textEncrypted: true`. The ones from before keep their plaintext until they
 * are next edited: there is no migration, so the flag is what tells a reader
 * which of the two it holds, and firestore.rules lets no moment be written
 * with plaintext text again.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '../config/firestore'
import { auth, db } from '../config/firebase'
import { decryptFields, decryptStringArray, encryptFields } from '../utils/encryption'
import { subscribeDecrypted } from './decrypted'
import { mediaRefsForCreate, mediaRefsForUpdate } from './mediaRefs'

const MOMENTS = 'moments'

export const MOMENT_TEXT_FIELDS = ['caption', 'category', 'location', 'label']

/**
 * Encrypt a new moment's text, and mark it as encrypted. The demo has no key
 * and stores its made-up text as it is, unflagged.
 */
export async function encryptMomentData(key, data) {
  const encrypted = await encryptFields(key, data, MOMENT_TEXT_FIELDS, { warnMissing: true })
  return key ? { ...encrypted, textEncrypted: true } : encrypted
}

/**
 * The same for an update. One that carries none of the text fields — a
 * thumbnail or a focus written onto a moment from before — is left alone, flag
 * included, so it does not claim an encryption it did not do. One that carries
 * any of them has to carry all four for a moment from before, or the rules
 * refuse it: the edit form always sends the whole form.
 */
async function encryptMomentUpdate(key, updates) {
  if (!MOMENT_TEXT_FIELDS.some((field) => field in updates)) return updates
  const encrypted = await encryptFields(key, updates, MOMENT_TEXT_FIELDS)
  return key ? { ...encrypted, textEncrypted: true } : encrypted
}

/** A moment's text, decrypted when it was written encrypted. */
export async function decryptMomentText(key, data) {
  if (!key || data.textEncrypted !== true) return data
  return decryptFields(key, data, MOMENT_TEXT_FIELDS)
}

/**
 * `thumbsTiny` is the exception, and it went unnoticed because it is not
 * written here. The shared upload path (utils/encryptedUpload.js) and the
 * shared thumbnail backfill (services/thumbnailMigration.js) both encrypt it for
 * moments exactly as they do for memories. Nothing decrypted it again, so every
 * moment card handed ~1 KB of ciphertext to an `<img src>`: no blur-up, and a
 * relative-URL request per card.
 *
 * The same field, the same call, the same reasoning as decryptMemory — ~700
 * bytes each, and it replaces a spinner with the photo's own colours.
 */
export async function decryptMoment(key, data) {
  if (!key) return data
  const result = await decryptMomentText(key, data)
  if (!Array.isArray(result.thumbsTiny)) return result
  return { ...result, thumbsTiny: await decryptStringArray(key, result.thumbsTiny) }
}

/** The family's latest moments, newest first. */
export function subscribeMoments(familyId, key, { pageSize }, onData, onError) {
  return subscribeDecrypted(
    query(collection(db, MOMENTS), where('familyId', '==', familyId), orderBy('date', 'desc'), limit(pageSize)),
    (docs) => Promise.all(docs.map((d) => decryptMoment(key, d))),
    onData,
    onError,
  )
}

export async function addMoment(familyId, key, moment) {
  await addDoc(collection(db, MOMENTS), {
    ...(await encryptMomentData(key, moment)),
    ...mediaRefsForCreate(moment),
    familyId,
    createdByUid: auth?.currentUser?.uid || null,
    date: serverTimestamp(),
  })
}

export async function updateMoment(key, id, updates) {
  await updateDoc(doc(db, MOMENTS, id), { ...(await encryptMomentUpdate(key, updates)), ...mediaRefsForUpdate(updates) })
}

export async function deleteMoment(id) {
  await deleteDoc(doc(db, MOMENTS, id))
}
