/**
 * Moments: the quick entries next to the memories.
 *
 * Their text — caption, location, category and label — is encrypted like a
 * memory's. It was not until November 2026, so a moment written before then
 * may still hold it in clear. `textEncrypted: true` tells the two apart: only a
 * moment that carries it is decrypted, and every write sets it. The ones
 * without it are encrypted in an admin's browser the next time one opens the
 * app (services/momentEncryption.js), and firestore.rules refuses a new
 * moment, or a change to an encrypted one, that is not ciphertext.
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

/** The text fields of a moment, all encrypted. */
export const MOMENT_TEXT_FIELDS = ['caption', 'location', 'category', 'label']

/**
 * Encrypt a moment's text and mark it as encrypted.
 *
 * The mark is set only on a write that carries all four fields, as the moment
 * form always does: one that carried only some would leave the others in clear
 * on a moment from before, which the reader would then try to decrypt. A write
 * without any of them changes neither the text nor the mark. Exported for the
 * migration, which encrypts the text a moment already has.
 */
export async function encryptMomentText(key, moment) {
  const present = MOMENT_TEXT_FIELDS.filter((field) => field in moment)
  if (present.length === 0) return moment
  if (present.length < MOMENT_TEXT_FIELDS.length) {
    throw new Error(`A moment's text is written as a whole: ${MOMENT_TEXT_FIELDS.join(', ')}`)
  }
  const encrypted = await encryptFields(key, moment, MOMENT_TEXT_FIELDS)
  return { ...encrypted, textEncrypted: true }
}

/**
 * The text of a moment as stored: decrypted when it is marked as encrypted,
 * as it is otherwise. The export reads this; the feed reads decryptMoment.
 */
export async function decryptMomentText(key, data) {
  if (!key || data.textEncrypted !== true) return data
  return decryptFields(key, data, MOMENT_TEXT_FIELDS)
}

/**
 * A moment for the feed: its text, and `thumbsTiny`, the blur-up previews.
 * Those are written by the shared upload path (utils/encryptedUpload.js) and
 * the shared thumbnail backfill (services/thumbnailMigration.js), both of
 * which encrypt them for moments exactly as for memories. ~700 bytes each, and
 * they replace a spinner with the photo's own colours.
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
  const encrypted = await encryptMomentText(key, moment)
  await addDoc(collection(db, MOMENTS), {
    ...encrypted,
    ...mediaRefsForCreate(moment),
    familyId,
    createdByUid: auth?.currentUser?.uid || null,
    date: serverTimestamp(),
  })
}

export async function updateMoment(key, id, updates) {
  const encrypted = await encryptMomentText(key, updates)
  await updateDoc(doc(db, MOMENTS, id), { ...encrypted, ...mediaRefsForUpdate(updates) })
}

export async function deleteMoment(id) {
  await deleteDoc(doc(db, MOMENTS, id))
}
