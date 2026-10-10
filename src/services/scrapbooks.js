/**
 * Scrapbooks. `pages` holds every element of every page of the whole book and
 * goes to Firestore as one encrypted blob.
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

const SCRAPBOOKS = 'scrapbooks'

/**
 * Nothing that skips decrypting `pages` can count the pages in it — the
 * overview would be left measuring the ciphertext. Keep the count next to the
 * blob as a plain number.
 */
function withPageCount(data) {
  if (!Array.isArray(data.pages)) return data
  return { ...data, pageCount: data.pages.length }
}

async function encryptScrapbook(key, data) {
  const result = { ...data }
  if (result.title != null) result.title = await encryptText(key, result.title)
  if (result.pages != null) result.pages = await encryptJSON(key, result.pages)
  return result
}

async function decryptScrapbook(key, data, { withPages = true } = {}) {
  if (!key) return data
  const result = { ...data }
  if (typeof result.title === 'string') result.title = await decryptText(key, result.title)
  // Decrypting and JSON-parsing every page for a list that only shows a title
  // and a cover is the most expensive thing a list could do, so callers have
  // to ask for it.
  if (withPages && typeof result.pages === 'string') {
    result.pages = await decryptJSON(key, result.pages)
  }
  return result
}

/**
 * The family's scrapbooks, newest first. `pages` stays encrypted unless asked
 * for — the overview only needs `title` and `coverImageUrl`, and the editor
 * loads its one book with getScrapbook.
 */
export function subscribeScrapbooks(familyId, key, { withPages = false } = {}, onData, onError) {
  return subscribeDecrypted(
    query(collection(db, SCRAPBOOKS), where('familyId', '==', familyId), orderBy('createdAt', 'desc')),
    (docs) => Promise.all(docs.map((d) => decryptScrapbook(key, d, { withPages }))),
    onData,
    onError,
  )
}

export function getScrapbook(familyId, key, id) {
  return getFamilyDocument(SCRAPBOOKS, id, familyId, (data) => decryptScrapbook(key, data))
}

export async function addScrapbook(familyId, key, data) {
  const encrypted = await encryptScrapbook(key, withPageCount(data))
  const ref = await addDoc(collection(db, SCRAPBOOKS), {
    ...encrypted,
    familyId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateScrapbook(key, id, data) {
  const encrypted = await encryptScrapbook(key, withPageCount(data))
  await updateDoc(doc(db, SCRAPBOOKS, id), {
    ...encrypted,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteScrapbook(id) {
  await deleteDoc(doc(db, SCRAPBOOKS, id))
}
