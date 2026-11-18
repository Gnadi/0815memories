/**
 * The kids' journals: entries and letters written for a child, newest first.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '../config/firestore'
import { db } from '../config/firebase'
import { decryptFields, encryptFields } from '../utils/encryption'
import { parseRichDoc } from '../utils/richText'
import { getFamilyDocument, subscribeDecrypted } from './decrypted'
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

const childEntries = (familyId, childId) =>
  query(
    collection(db, JOURNALS),
    where('familyId', '==', familyId),
    where('childId', '==', childId),
    orderBy('date', 'desc'),
  )

/** One child's entries. */
export function subscribeJournals(familyId, childId, key, onData, onError) {
  return subscribeDecrypted(
    childEntries(familyId, childId),
    (docs) => Promise.all(docs.map((d) => decryptJournal(key, d))),
    onData,
    onError,
  )
}

/**
 * How many entries a child has, and the date of the latest — what the journal
 * overview shows. Neither needs a word of the entries themselves: the count is
 * counted by the server, and `date` is stored readable, so nothing here is
 * downloaded in full or decrypted. The overview used to read and decrypt every
 * entry of every child for these two numbers.
 *
 * @returns {Promise<{ count: number, latest: { date: unknown } | null }>}
 */
export async function getJournalSummary(familyId, childId) {
  const entries = childEntries(familyId, childId)
  const [counted, newest] = await Promise.all([
    getCountFromServer(entries),
    getDocs(query(entries, limit(1))),
  ])
  const [first] = newest.docs
  return { count: counted.data().count, latest: first ? { date: first.data().date } : null }
}

/** One entry of `childId`, decrypted, or null when there is none. */
export async function getJournal(familyId, childId, key, id) {
  const entry = await getFamilyDocument(JOURNALS, id, familyId, (data) => decryptJournal(key, data))
  return entry?.childId === childId ? entry : null
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
