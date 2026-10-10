/**
 * Highlight videos. A document stores the *recipe* — shot list, durations,
 * title card, theme — not the rendered file. The reel is re-rendered on demand
 * from photos the family already has, which keeps these documents tiny and
 * avoids pushing a video through Cloudinary's 10 MB raw-asset cap.
 */
import {
  addDoc,
  collection,
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

const HIGHLIGHTS = 'highlights'

async function encryptHighlight(key, data) {
  const result = { ...data }
  if (result.title != null) result.title = await encryptText(key, result.title)
  if (result.doc != null) result.doc = await encryptJSON(key, result.doc)
  return result
}

export async function decryptHighlight(key, data, { withDoc = true } = {}) {
  if (!key) return data
  const result = { ...data }
  if (typeof result.title === 'string') result.title = await decryptText(key, result.title)
  if (withDoc && typeof result.doc === 'string') {
    result.doc = await decryptJSON(key, result.doc)
  }
  return result
}

/** The family's highlights, newest first; `doc` only for those who ask. */
export function subscribeHighlights(familyId, key, { withDoc = false } = {}, onData, onError) {
  return subscribeDecrypted(
    query(collection(db, HIGHLIGHTS), where('familyId', '==', familyId), orderBy('createdAt', 'desc')),
    (docs) => Promise.all(docs.map((d) => decryptHighlight(key, d, { withDoc }))),
    onData,
    onError,
  )
}

export function getHighlight(familyId, key, id) {
  return getFamilyDocument(HIGHLIGHTS, id, familyId, (data) => decryptHighlight(key, data))
}

export async function addHighlight(familyId, key, data) {
  const encrypted = await encryptHighlight(key, data)
  const ref = await addDoc(collection(db, HIGHLIGHTS), {
    ...encrypted,
    familyId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateHighlight(key, id, data) {
  const encrypted = await encryptHighlight(key, data)
  await updateDoc(doc(db, HIGHLIGHTS, id), {
    ...encrypted,
    updatedAt: serverTimestamp(),
  })
}
