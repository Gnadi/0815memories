/**
 * Moments: the quick entries next to the memories.
 *
 * They keep their text in clear: caption, category, location and label are not
 * encrypted, and utils/nasExport.js says so in a line of its own.
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
import { decryptStringArray } from '../utils/encryption'
import { subscribeDecrypted } from './decrypted'

const MOMENTS = 'moments'

/**
 * `thumbsTiny` is the exception, and it went unnoticed because it is not
 * written here. The shared upload path (utils/encryptedUpload.js) and the
 * shared thumbnail backfill (utils/thumbnailMigration.js) both encrypt it for
 * moments exactly as they do for memories. Nothing decrypted it again, so every
 * moment card handed ~1 KB of ciphertext to an `<img src>`: no blur-up, and a
 * relative-URL request per card.
 *
 * The same field, the same call, the same reasoning as decryptMemory — ~700
 * bytes each, and it replaces a spinner with the photo's own colours.
 */
async function decryptMoment(key, data) {
  if (!key || !Array.isArray(data.thumbsTiny)) return data
  return { ...data, thumbsTiny: await decryptStringArray(key, data.thumbsTiny) }
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

export async function addMoment(familyId, moment) {
  await addDoc(collection(db, MOMENTS), {
    ...moment,
    familyId,
    createdByUid: auth?.currentUser?.uid || null,
    date: serverTimestamp(),
  })
}

export async function updateMoment(id, updates) {
  await updateDoc(doc(db, MOMENTS, id), updates)
}

export async function deleteMoment(id) {
  await deleteDoc(doc(db, MOMENTS, id))
}
