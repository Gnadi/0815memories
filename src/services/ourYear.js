/**
 * Firestore access for "Our Year".
 *
 * Four collections, all top-level with a `familyId` field like the rest of the
 * app, but every document additionally carries `participantUids` — the two
 * partners. That array is what the security rules key on, so no other admin of
 * the family can read any of it.
 */
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from '../config/firestore'
import { db } from '../config/firebase'
import { decryptJSON, decryptText, encryptJSON, encryptText } from '../utils/encryption'
import { emptyKeepsakes } from '../utils/ourYear'
import { subscribeDecrypted, subscribeDecryptedDocument } from './decrypted'

export const RITUALS = 'ourYearRituals'
export const CHAPTERS = 'ourYearChapters'
export const ENTRIES = 'ourYearEntries'
export const LETTERS = 'ourYearLetters'

// What each collection encrypts — the text fields, and the fields holding an
// encrypted JSON value. The NAS export reads them from here.
export const OUR_YEAR_ENCRYPTED_FIELDS = {
  [RITUALS]: { text: ['occasionLabel'], json: ['partners'] },
  [CHAPTERS]: { text: ['title'], json: ['quizQuestions', 'quizReactions', 'keepsakes'] },
  [ENTRIES]: { text: [], json: ['answers'] },
  [LETTERS]: { text: [], json: ['sections'] },
}

/** Deterministic id, so a person can only ever have one entry per chapter and part. */
export function entryId(chapterId, kind, uid) {
  return `${chapterId}_${kind}_${uid}`
}

const submittedField = (kind) => (kind === 'quiz' ? 'quizSubmittedBy' : 'reflectionSubmittedBy')
const revealedField = (kind) => (kind === 'quiz' ? 'quizRevealedAt' : 'reflectionsRevealedAt')

// ---------------------------------------------------------------------------
// Encryption — field names here must match exactly what we write.
// ---------------------------------------------------------------------------

async function encryptRitual(key, data) {
  const out = { ...data }
  if (out.partners != null) out.partners = await encryptJSON(key, out.partners)
  if (out.occasionLabel != null) out.occasionLabel = await encryptText(key, out.occasionLabel)
  return out
}

async function decryptRitual(key, data) {
  if (!key) return data
  const out = { ...data }
  if (typeof out.partners === 'string') out.partners = await decryptJSON(key, out.partners)
  if (typeof out.occasionLabel === 'string') out.occasionLabel = await decryptText(key, out.occasionLabel)
  if (!Array.isArray(out.partners)) out.partners = []
  return out
}

async function encryptChapter(key, data) {
  const out = { ...data }
  if (out.title != null) out.title = await encryptText(key, out.title)
  if (out.quizQuestions != null) out.quizQuestions = await encryptJSON(key, out.quizQuestions)
  if (out.quizReactions != null) out.quizReactions = await encryptJSON(key, out.quizReactions)
  if (out.keepsakes != null) out.keepsakes = await encryptJSON(key, out.keepsakes)
  return out
}

async function decryptChapter(key, data) {
  const out = { ...data }
  if (key) {
    if (typeof out.title === 'string') out.title = await decryptText(key, out.title)
    if (typeof out.quizQuestions === 'string') out.quizQuestions = await decryptJSON(key, out.quizQuestions)
    if (typeof out.quizReactions === 'string') out.quizReactions = await decryptJSON(key, out.quizReactions)
    if (typeof out.keepsakes === 'string') out.keepsakes = await decryptJSON(key, out.keepsakes)
  }
  if (!Array.isArray(out.quizQuestions)) out.quizQuestions = []
  if (!out.quizReactions || typeof out.quizReactions !== 'object') out.quizReactions = {}
  if (!out.keepsakes || typeof out.keepsakes !== 'object') out.keepsakes = emptyKeepsakes()
  return out
}

async function decryptEntry(key, data) {
  const out = { ...data }
  if (key && typeof out.answers === 'string') out.answers = await decryptJSON(key, out.answers)
  if (!out.answers || typeof out.answers !== 'object') out.answers = {}
  return out
}

async function decryptLetter(key, data) {
  const out = { ...data }
  if (key && typeof out.sections === 'string') out.sections = await decryptJSON(key, out.sections)
  if (!out.sections || typeof out.sections !== 'object') out.sections = {}
  return out
}

// ---------------------------------------------------------------------------
// The ritual
// ---------------------------------------------------------------------------

/**
 * The couple's ritual, found by membership rather than by family: a family can
 * hold more than one couple, and each only ever sees its own. `onData` gets it,
 * or null when there is none.
 */
export function subscribeRitual(familyId, uid, key, onData, onError) {
  return subscribeDecrypted(
    query(collection(db, RITUALS), where('participantUids', 'array-contains', uid)),
    async (docs) => {
      const own = docs.filter((d) => !familyId || d.familyId === familyId)
      const [first] = await Promise.all(own.map((d) => decryptRitual(key, d)))
      return first ?? null
    },
    onData,
    onError,
  )
}

export async function createRitual(familyId, uid, key, data) {
  const encrypted = await encryptRitual(key, data)
  const ref = await addDoc(collection(db, RITUALS), {
    ...encrypted,
    familyId,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateRitual(key, id, data) {
  const encrypted = await encryptRitual(key, data)
  await updateDoc(doc(db, RITUALS, id), { ...encrypted, updatedAt: serverTimestamp() })
}

// ---------------------------------------------------------------------------
// Chapters
// ---------------------------------------------------------------------------

/**
 * The couple's chapters, newest first.
 *
 * The `participantUids` filter is not redundant with `ritualId` — it is what
 * makes the query legal. Security rules are not filters: for a list, Firestore
 * rejects the whole query unless its constraints prove the read rule holds for
 * every possible match. The rule allows a chapter only to its participants, so
 * the query has to say so.
 */
export function subscribeChapters(ritualId, uid, key, onData, onError) {
  return subscribeDecrypted(
    query(
      collection(db, CHAPTERS),
      where('participantUids', 'array-contains', uid),
      where('ritualId', '==', ritualId),
      orderBy('periodStart', 'desc'),
    ),
    (docs) => Promise.all(docs.map((d) => decryptChapter(key, d))),
    onData,
    onError,
  )
}

/** A single chapter, live; null while it does not exist. */
export function subscribeChapter(chapterId, key, onData, onError) {
  return subscribeDecryptedDocument(
    doc(db, CHAPTERS, chapterId),
    (data) => decryptChapter(key, data),
    onData,
    onError,
  )
}

export async function addChapter(key, ritual, data) {
  const encrypted = await encryptChapter(key, data)
  const ref = await addDoc(collection(db, CHAPTERS), {
    ...encrypted,
    familyId: ritual.familyId,
    ritualId: ritual.id,
    participantUids: ritual.participantUids,
    status: 'open',
    reflectionSubmittedBy: [],
    quizSubmittedBy: [],
    reflectionsRevealedAt: null,
    quizRevealedAt: null,
    letterStatus: 'none',
    letterOpenAt: null,
    letterOpenedAt: null,
    closedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateChapter(key, id, data) {
  const encrypted = await encryptChapter(key, data)
  await updateDoc(doc(db, CHAPTERS, id), { ...encrypted, updatedAt: serverTimestamp() })
}

export async function closeChapter(id) {
  await updateDoc(doc(db, CHAPTERS, id), {
    status: 'closed',
    closedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Removes a chapter with everything hanging off it. Only ever offered while
 * the chapter is still open.
 *
 * The entries are addressed by their deterministic ids rather than found by
 * query on purpose: before the reveal, a query would include the partner's
 * document, which this person may not read — and Firestore fails the whole
 * query rather than filtering it out.
 *
 * The chapter goes first. firestore.rules only lets a handed-in answer be
 * deleted once its chapter is gone — otherwise deleting and rewriting it
 * would undo the hand-in after the partner's answers were visible.
 */
export async function deleteChapter(chapter) {
  const ids = (chapter.participantUids ?? []).flatMap((participant) =>
    ['reflection', 'quiz'].map((kind) => entryId(chapter.id, kind, participant)),
  )
  await deleteDoc(doc(db, CHAPTERS, chapter.id))
  await Promise.allSettled(ids.map((id) => deleteDoc(doc(db, ENTRIES, id))))
  await deleteDoc(doc(db, LETTERS, chapter.id)).catch(() => {})
}

// ---------------------------------------------------------------------------
// Entries — the part that has to stay apart until both are done
// ---------------------------------------------------------------------------

/** One person's answers to one part of a chapter; null until there are any. */
export function subscribeEntry(chapterId, kind, uid, key, onData, onError) {
  return subscribeDecryptedDocument(
    doc(db, ENTRIES, entryId(chapterId, kind, uid)),
    (data) => decryptEntry(key, data),
    onData,
    onError,
  )
}

/**
 * Writes this person's answers. `exists` says whether their entry is already
 * there: only its creation sets `revealed` to false, so that a later write can
 * never un-share answers the couple has already looked at.
 */
export async function writeEntry(key, { chapter, kind, uid, answers, submitted, exists }) {
  const payload = {
    familyId: chapter.familyId,
    chapterId: chapter.id,
    participantUids: chapter.participantUids ?? [],
    authorUid: uid,
    kind,
    answers: await encryptJSON(key, answers),
    submitted,
    updatedAt: serverTimestamp(),
  }
  if (submitted) payload.submittedAt = serverTimestamp()
  if (!exists) {
    payload.revealed = false
    payload.createdAt = serverTimestamp()
  }
  await setDoc(doc(db, ENTRIES, entryId(chapter.id, kind, uid)), payload, { merge: true })
}

/** Marks this person's part as handed in on the chapter. */
export async function markSubmitted(chapterId, kind, uid) {
  await updateDoc(doc(db, CHAPTERS, chapterId), {
    [submittedField(kind)]: arrayUnion(uid),
    updatedAt: serverTimestamp(),
  })
}

/** The first half of the reveal: the chapter says the answers are out. */
export async function markRevealed(chapterId, kind) {
  await updateDoc(doc(db, CHAPTERS, chapterId), {
    [revealedField(kind)]: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/** The second half: each partner's entry is opened to the other. */
export async function revealEntries(chapterId, kind, participantUids) {
  await Promise.all(
    participantUids.map((participant) =>
      // `revealed` must be the only key in this write — the rule that lets
      // one partner touch the other's document allows nothing else.
      updateDoc(doc(db, ENTRIES, entryId(chapterId, kind, participant)), { revealed: true }),
    ),
  )
}

// ---------------------------------------------------------------------------
// The sealed letter
// ---------------------------------------------------------------------------

/** The chapter's letter, once it may be read; null while there is none. */
export function subscribeLetter(chapterId, key, onData, onError) {
  return subscribeDecryptedDocument(
    doc(db, LETTERS, chapterId),
    (data) => decryptLetter(key, data),
    onData,
    onError,
  )
}

// The letter's text, as a draft. `exists` says whether the letter is already
// there: the create rule only accepts one that is not sealed yet.
async function writeLetterDraft(key, chapter, sections, exists) {
  const payload = {
    familyId: chapter.familyId,
    chapterId: chapter.id,
    participantUids: chapter.participantUids,
    sections: await encryptJSON(key, sections),
    updatedAt: serverTimestamp(),
  }
  if (!exists) {
    payload.sealedAt = null
    payload.openAt = null
    payload.openedAt = null
    payload.createdAt = serverTimestamp()
  }
  await setDoc(doc(db, LETTERS, chapter.id), payload, { merge: true })
}

export async function saveLetterDraft(key, { chapter, sections, exists }) {
  await writeLetterDraft(key, chapter, sections, exists)
  if ((chapter.letterStatus ?? 'none') === 'none') {
    await updateDoc(doc(db, CHAPTERS, chapter.id), {
      letterStatus: 'draft',
      updatedAt: serverTimestamp(),
    })
  }
}

/**
 * Seals the letter — deliberately two writes.
 *
 * The create rule only accepts a letter that is not yet sealed, so the text
 * has to land first. Sealing is then its own, final write: `sealedAt` and
 * `openAt` must go in together, because the instant `sealedAt` is set the
 * rule stops accepting anything until the open date.
 */
export async function sealLetter(key, { chapter, sections, openAt, exists }) {
  const openTimestamp = Timestamp.fromDate(openAt)
  await writeLetterDraft(key, chapter, sections, exists)
  await updateDoc(doc(db, LETTERS, chapter.id), {
    sealedAt: serverTimestamp(),
    openAt: openTimestamp,
    updatedAt: serverTimestamp(),
  })
  await updateDoc(doc(db, CHAPTERS, chapter.id), {
    letterStatus: 'sealed',
    letterOpenAt: openTimestamp,
    updatedAt: serverTimestamp(),
  })
}

export async function openLetter(chapterId) {
  await updateDoc(doc(db, LETTERS, chapterId), { openedAt: serverTimestamp() })
  await updateDoc(doc(db, CHAPTERS, chapterId), {
    letterStatus: 'opened',
    letterOpenedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
