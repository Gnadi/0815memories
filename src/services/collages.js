/**
 * Collages. `doc` holds the whole collage — template id, styling and every
 * slot's photo URL — encrypted as one JSON blob, exactly like a scrapbook's
 * `pages`.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '../config/firestore'
import { db } from '../config/firebase'
import { decryptJSON, decryptText, encryptJSON, encryptText } from '../utils/encryption'
import { getFamilyDocument, subscribeDecrypted } from './decrypted'

const COLLAGES = 'collages'

async function encryptCollage(key, data) {
  if (!key) return data
  const result = { ...data }
  if (result.title != null) result.title = await encryptText(key, result.title)
  if (result.doc != null) result.doc = await encryptJSON(key, result.doc)
  return result
}

export async function decryptCollage(key, data, { withDoc = true } = {}) {
  if (!key) return data
  const result = { ...data }
  if (typeof result.title === 'string') result.title = await decryptText(key, result.title)
  // Opt-in, same reasoning as scrapbooks: a caller that only lists titles
  // should not JSON-parse every collage's slot list on every snapshot. The
  // gallery does ask for it — it re-draws each collage from the document
  // instead of storing a rendered cover image.
  if (withDoc && typeof result.doc === 'string') {
    result.doc = await decryptJSON(key, result.doc)
  }
  return result
}

/** The family's collages, newest first; `doc` only for those who ask. */
export function subscribeCollages(familyId, key, { withDoc = false } = {}, onData, onError) {
  return subscribeDecrypted(
    query(collection(db, COLLAGES), where('familyId', '==', familyId), orderBy('createdAt', 'desc')),
    (docs) => Promise.all(docs.map((d) => decryptCollage(key, d, { withDoc }))),
    onData,
    onError,
  )
}

export function getCollage(familyId, key, id) {
  return getFamilyDocument(COLLAGES, id, familyId, (data) => decryptCollage(key, data))
}

export async function addCollage(familyId, key, data) {
  const encrypted = await encryptCollage(key, data)
  const ref = await addDoc(collection(db, COLLAGES), {
    ...encrypted,
    familyId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateCollage(key, id, data) {
  const encrypted = await encryptCollage(key, data)
  await updateDoc(doc(db, COLLAGES, id), {
    ...encrypted,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteCollage(id) {
  await deleteDoc(doc(db, COLLAGES, id))
}
