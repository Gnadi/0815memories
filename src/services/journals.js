/**
 * The kids' journals: entries and letters written for a child, newest first.
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
import { decryptFields, encryptFields } from '../utils/encryption'
import { subscribeDecrypted } from './decrypted'

const JOURNALS = 'journals'

export const JOURNAL_ENCRYPTED_FIELDS = ['content']

export function decryptJournal(key, data) {
  return decryptFields(key, data, JOURNAL_ENCRYPTED_FIELDS)
}

/** One child's entries. */
export function subscribeJournals(familyId, childId, key, onData, onError) {
  return subscribeDecrypted(
    query(
      collection(db, JOURNALS),
      where('familyId', '==', familyId),
      where('childId', '==', childId),
      orderBy('date', 'desc'),
    ),
    (docs) => Promise.all(docs.map((d) => decryptJournal(key, d))),
    onData,
    onError,
  )
}

/** Every child's entries. */
export function subscribeAllJournals(familyId, key, onData, onError) {
  return subscribeDecrypted(
    query(collection(db, JOURNALS), where('familyId', '==', familyId), orderBy('date', 'desc')),
    (docs) => Promise.all(docs.map((d) => decryptJournal(key, d))),
    onData,
    onError,
  )
}

export async function addJournal(familyId, childId, key, entry) {
  const encrypted = await encryptFields(key, entry, JOURNAL_ENCRYPTED_FIELDS)
  await addDoc(collection(db, JOURNALS), {
    ...encrypted,
    familyId,
    childId,
    createdAt: serverTimestamp(),
  })
}

export async function updateJournal(key, id, updates) {
  const encrypted = await encryptFields(key, updates, JOURNAL_ENCRYPTED_FIELDS)
  await updateDoc(doc(db, JOURNALS, id), encrypted)
}

export async function deleteJournal(id) {
  await deleteDoc(doc(db, JOURNALS, id))
}
