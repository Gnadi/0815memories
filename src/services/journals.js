/**
 * The kids' journals: entries and letters written for a child, newest first.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '../config/firestore'
import { db } from '../config/firebase'
import { decryptFields, encryptFields } from '../utils/encryption'
import { parseRichDoc } from '../utils/richText'
import { subscribeDecrypted } from './decrypted'
import { mediaRefsForCreate, mediaRefsForUpdate } from './mediaRefs'

const JOURNALS = 'journals'

/**
 * How an entry's text was written, in `contentFormat`:
 *
 * - 'rich': the rich editor's document in `contentRich`, with a plain-text
 *   mirror in `content` for everything that only shows text (the NAS export,
 *   a client from before the editor).
 * - 'markdown': the Markdown source in `content`, read with
 *   src/utils/markdown.js.
 * - absent: an entry from before either, plain text in `content`.
 *
 * The same three as a recipe's instructions. src/utils/journalContent.js moves
 * between them and the form.
 */
export const CONTENT_FORMATS = ['rich', 'markdown']

// `contentRich` is a JSON string by the time it is encrypted: encryptFields
// skips a value that is not a string, and an object would be stored readable.
export const JOURNAL_ENCRYPTED_FIELDS = ['content', 'contentRich']

async function encryptJournal(key, data) {
  const input = { ...data }
  if (input.contentRich != null && typeof input.contentRich !== 'string') {
    input.contentRich = JSON.stringify(input.contentRich)
  }
  return encryptFields(key, input, JOURNAL_ENCRYPTED_FIELDS)
}

export async function decryptJournal(key, data) {
  const result = await decryptFields(key, data, JOURNAL_ENCRYPTED_FIELDS)
  if (result.contentRich != null) result.contentRich = parseRichDoc(result.contentRich)
  return result
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

/** `contentRich` of null is left out: a new entry without a document has none. */
export async function addJournal(familyId, childId, key, entry) {
  const { contentRich, ...rest } = entry
  const encrypted = await encryptJournal(key, contentRich == null ? rest : entry)
  await addDoc(collection(db, JOURNALS), {
    ...encrypted,
    ...mediaRefsForCreate(entry),
    familyId,
    childId,
    createdAt: serverTimestamp(),
  })
}

/**
 * A `contentRich` of null deletes the document — the entry was switched to
 * Markdown — so no stale document is left behind next to the new text.
 */
export async function updateJournal(key, id, updates) {
  const { contentRich, ...rest } = updates
  const encrypted = await encryptJournal(key, contentRich == null ? rest : updates)
  await updateDoc(doc(db, JOURNALS, id), {
    ...encrypted,
    ...(contentRich === null ? { contentRich: deleteField() } : {}),
    ...mediaRefsForUpdate(updates),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteJournal(id) {
  await deleteDoc(doc(db, JOURNALS, id))
}
