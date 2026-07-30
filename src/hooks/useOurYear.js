import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { devError } from '../utils/devLog'
import { encryptText, decryptText, encryptJSON, decryptJSON } from '../utils/encryption'
import { bothSubmitted, emptyKeepsakes, isLetterLocked, isRevealed } from '../utils/ourYear'

/**
 * Firestore access for "Our Year".
 *
 * Four collections, all top-level with a `familyId` field like the rest of the
 * app, but every document additionally carries `participantUids` — the two
 * partners. That array is what the security rules key on, so no other admin of
 * the family can read any of it.
 */
export const RITUALS = 'ourYearRituals'
export const CHAPTERS = 'ourYearChapters'
export const ENTRIES = 'ourYearEntries'
export const LETTERS = 'ourYearLetters'

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
  if (!key) return data
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
  if (!key) return data
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

// ---------------------------------------------------------------------------
// The ritual
// ---------------------------------------------------------------------------

/**
 * The couple's ritual, found by membership rather than by family: a family can
 * hold more than one couple, and each only ever sees its own.
 */
export function useOurYearRitual(familyId, uid, encryptionKey) {
  const [ritual, setRitual] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid || !db) {
      setLoading(false)
      return
    }
    const q = query(collection(db, RITUALS), where('participantUids', 'array-contains', uid))
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const docs = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((d) => !familyId || d.familyId === familyId)
        const decrypted = await Promise.all(docs.map((d) => decryptRitual(encryptionKey, d)))
        setRitual(decrypted[0] ?? null)
        setLoading(false)
      },
      (error) => {
        devError('Failed to load the Our Year ritual:', error)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [familyId, uid, encryptionKey])

  const createRitual = useCallback(
    async (data) => {
      const encrypted = await encryptRitual(encryptionKey, data)
      const ref = await addDoc(collection(db, RITUALS), {
        ...encrypted,
        familyId,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      return ref.id
    },
    [familyId, uid, encryptionKey],
  )

  const updateRitual = useCallback(
    async (id, data) => {
      const encrypted = await encryptRitual(encryptionKey, data)
      await updateDoc(doc(db, RITUALS, id), { ...encrypted, updatedAt: serverTimestamp() })
    },
    [encryptionKey],
  )

  return { ritual, loading, createRitual, updateRitual }
}

// ---------------------------------------------------------------------------
// Chapters
// ---------------------------------------------------------------------------

export function useOurYearChapters(ritualId, encryptionKey) {
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ritualId || !db) {
      setChapters([])
      setLoading(false)
      return
    }
    const q = query(
      collection(db, CHAPTERS),
      where('ritualId', '==', ritualId),
      orderBy('periodStart', 'desc'),
    )
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        setChapters(await Promise.all(docs.map((d) => decryptChapter(encryptionKey, d))))
        setLoading(false)
      },
      (error) => {
        devError('Failed to load Our Year chapters:', error)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [ritualId, encryptionKey])

  const addChapter = useCallback(
    async (ritual, data) => {
      const encrypted = await encryptChapter(encryptionKey, data)
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
    },
    [encryptionKey],
  )

  const updateChapter = useCallback(
    async (id, data) => {
      const encrypted = await encryptChapter(encryptionKey, data)
      await updateDoc(doc(db, CHAPTERS, id), { ...encrypted, updatedAt: serverTimestamp() })
    },
    [encryptionKey],
  )

  /**
   * Removes a chapter with everything hanging off it. Only ever offered while
   * the chapter is still open.
   *
   * The entries are addressed by their deterministic ids rather than found by
   * query on purpose: before the reveal, a query would include the partner's
   * document, which this person may not read — and Firestore fails the whole
   * query rather than filtering it out.
   */
  const deleteChapter = useCallback(async (chapter) => {
    const ids = (chapter.participantUids ?? []).flatMap((participant) =>
      ['reflection', 'quiz'].map((kind) => entryId(chapter.id, kind, participant)),
    )
    await Promise.allSettled(ids.map((id) => deleteDoc(doc(db, ENTRIES, id))))
    await deleteDoc(doc(db, LETTERS, chapter.id)).catch(() => {})
    await deleteDoc(doc(db, CHAPTERS, chapter.id))
  }, [])

  return { chapters, loading, addChapter, updateChapter, deleteChapter }
}

/** A single chapter, live. Used by the chapter page. */
export function useOurYearChapter(chapterId, encryptionKey) {
  const [chapter, setChapter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (!chapterId || !db) {
      setLoading(false)
      return
    }
    const unsubscribe = onSnapshot(
      doc(db, CHAPTERS, chapterId),
      async (snapshot) => {
        if (!snapshot.exists()) {
          setChapter(null)
          setMissing(true)
          setLoading(false)
          return
        }
        setChapter(await decryptChapter(encryptionKey, { id: snapshot.id, ...snapshot.data() }))
        setMissing(false)
        setLoading(false)
      },
      (error) => {
        devError('Failed to load the Our Year chapter:', error)
        setMissing(true)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [chapterId, encryptionKey])

  const updateChapter = useCallback(
    async (data) => {
      const encrypted = await encryptChapter(encryptionKey, data)
      await updateDoc(doc(db, CHAPTERS, chapterId), { ...encrypted, updatedAt: serverTimestamp() })
    },
    [chapterId, encryptionKey],
  )

  return { chapter, loading, missing, updateChapter }
}

// ---------------------------------------------------------------------------
// Entries — the part that has to stay apart until both are done
// ---------------------------------------------------------------------------

/**
 * One person's answers to one part of one chapter.
 *
 * The partner's document is only subscribed to once the chapter says the
 * answers are revealed — before that Firestore would refuse the read anyway,
 * and asking for it would just produce a permission error in the console.
 *
 * @param {object} chapter
 * @param {'reflection'|'quiz'} kind
 * @param {string} uid
 * @param {CryptoKey} encryptionKey
 */
export function useOurYearEntries(chapter, kind, uid, encryptionKey) {
  const [own, setOwn] = useState(null)
  const [partner, setPartner] = useState(null)
  const [loading, setLoading] = useState(true)

  const chapterId = chapter?.id ?? null
  const participantUids = useMemo(() => chapter?.participantUids ?? [], [chapter])
  const partnerUid = participantUids.find((u) => u !== uid) ?? null
  const revealed = isRevealed(chapter, kind)

  const decryptEntry = useCallback(
    async (data) => {
      const out = { ...data }
      if (encryptionKey && typeof out.answers === 'string') {
        out.answers = await decryptJSON(encryptionKey, out.answers)
      }
      if (!out.answers || typeof out.answers !== 'object') out.answers = {}
      return out
    },
    [encryptionKey],
  )

  useEffect(() => {
    if (!chapterId || !uid || !db) {
      setLoading(false)
      return
    }
    const unsubscribe = onSnapshot(
      doc(db, ENTRIES, entryId(chapterId, kind, uid)),
      async (snapshot) => {
        setOwn(snapshot.exists() ? await decryptEntry({ id: snapshot.id, ...snapshot.data() }) : null)
        setLoading(false)
      },
      (error) => {
        devError('Failed to load your Our Year answers:', error)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [chapterId, kind, uid, decryptEntry])

  useEffect(() => {
    if (!chapterId || !partnerUid || !revealed || !db) {
      setPartner(null)
      return
    }
    const unsubscribe = onSnapshot(
      doc(db, ENTRIES, entryId(chapterId, kind, partnerUid)),
      async (snapshot) => {
        setPartner(snapshot.exists() ? await decryptEntry({ id: snapshot.id, ...snapshot.data() }) : null)
      },
      (error) => {
        devError('Failed to load your partner\'s Our Year answers:', error)
      },
    )
    return unsubscribe
  }, [chapterId, kind, partnerUid, revealed, decryptEntry])

  const writeOwn = useCallback(
    async (answers, submitted) => {
      const payload = {
        familyId: chapter.familyId,
        chapterId,
        participantUids,
        authorUid: uid,
        kind,
        answers: encryptionKey ? await encryptJSON(encryptionKey, answers) : answers,
        submitted,
        updatedAt: serverTimestamp(),
      }
      if (submitted) payload.submittedAt = serverTimestamp()
      if (!own) {
        // Only on create — a later write must never push `revealed` back to
        // false and un-share answers the couple has already looked at.
        payload.revealed = false
        payload.createdAt = serverTimestamp()
      }
      await setDoc(doc(db, ENTRIES, entryId(chapterId, kind, uid)), payload, { merge: true })
    },
    [chapter, chapterId, participantUids, uid, kind, encryptionKey, own],
  )

  const saveDraft = useCallback((answers) => writeOwn(answers, false), [writeOwn])

  /** Hands in this person's part. From here on it is fixed. */
  const submit = useCallback(
    async (answers) => {
      await writeOwn(answers, true)
      await updateDoc(doc(db, CHAPTERS, chapterId), {
        [submittedField(kind)]: arrayUnion(uid),
        updatedAt: serverTimestamp(),
      })
    },
    [writeOwn, chapterId, kind, uid],
  )

  // The reveal. Whoever's client first sees both names on the chapter writes it
  // — for their own entry as author, for their partner's through the rule that
  // allows exactly one key to change. Idempotent, so a race between the two
  // devices is harmless.
  useEffect(() => {
    if (!chapterId || !db) return
    if (revealed || !bothSubmitted(chapter, kind)) return
    let cancelled = false
    async function reveal() {
      try {
        await updateDoc(doc(db, CHAPTERS, chapterId), {
          [revealedField(kind)]: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        if (cancelled) return
        await Promise.all(
          participantUids.map((participant) =>
            // `revealed` must be the only key in this write — the rule that lets
            // one partner touch the other's document allows nothing else.
            updateDoc(doc(db, ENTRIES, entryId(chapterId, kind, participant)), { revealed: true }),
          ),
        )
      } catch (error) {
        devError('Failed to reveal the Our Year answers:', error)
      }
    }
    reveal()
    return () => { cancelled = true }
  }, [chapter, chapterId, kind, participantUids, revealed])

  return { own, partner, loading, revealed, saveDraft, submit }
}

// ---------------------------------------------------------------------------
// The sealed letter
// ---------------------------------------------------------------------------

/**
 * The letter to the couple's future self.
 *
 * While it is sealed and the open date is still ahead, Firestore refuses to
 * hand out the document at all — so we don't even subscribe. The chapter
 * carries `letterStatus` and `letterOpenAt`, which is everything the UI needs
 * to show the wait.
 */
export function useOurYearLetter(chapter, encryptionKey) {
  const [letter, setLetter] = useState(null)
  const [loading, setLoading] = useState(true)

  const chapterId = chapter?.id ?? null
  const locked = isLetterLocked(chapter)

  useEffect(() => {
    if (!chapterId || locked || !db) {
      setLetter(null)
      setLoading(false)
      return
    }
    const unsubscribe = onSnapshot(
      doc(db, LETTERS, chapterId),
      async (snapshot) => {
        if (!snapshot.exists()) {
          setLetter(null)
          setLoading(false)
          return
        }
        const data = { id: snapshot.id, ...snapshot.data() }
        if (encryptionKey && typeof data.sections === 'string') {
          data.sections = await decryptJSON(encryptionKey, data.sections)
        }
        if (!data.sections || typeof data.sections !== 'object') data.sections = {}
        setLetter(data)
        setLoading(false)
      },
      (error) => {
        devError('Failed to load the Our Year letter:', error)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [chapterId, locked, encryptionKey])

  const saveDraft = useCallback(
    async (sections) => {
      const payload = {
        familyId: chapter.familyId,
        chapterId,
        participantUids: chapter.participantUids,
        sections: encryptionKey ? await encryptJSON(encryptionKey, sections) : sections,
        updatedAt: serverTimestamp(),
      }
      if (!letter) {
        payload.sealedAt = null
        payload.openAt = null
        payload.openedAt = null
        payload.createdAt = serverTimestamp()
      }
      await setDoc(doc(db, LETTERS, chapterId), payload, { merge: true })
      if ((chapter.letterStatus ?? 'none') === 'none') {
        await updateDoc(doc(db, CHAPTERS, chapterId), {
          letterStatus: 'draft',
          updatedAt: serverTimestamp(),
        })
      }
    },
    [chapter, chapterId, encryptionKey, letter],
  )

  /**
   * Seals the letter — deliberately two writes.
   *
   * The create rule only accepts a letter that is not yet sealed, so the text
   * has to land first. Sealing is then its own, final write: `sealedAt` and
   * `openAt` must go in together, because the instant `sealedAt` is set the
   * rule stops accepting anything until the open date.
   */
  const seal = useCallback(
    async (sections, openAt) => {
      const openTimestamp = Timestamp.fromDate(openAt)
      const draft = {
        familyId: chapter.familyId,
        chapterId,
        participantUids: chapter.participantUids,
        sections: encryptionKey ? await encryptJSON(encryptionKey, sections) : sections,
        updatedAt: serverTimestamp(),
      }
      if (!letter) {
        draft.sealedAt = null
        draft.openAt = null
        draft.openedAt = null
        draft.createdAt = serverTimestamp()
      }
      await setDoc(doc(db, LETTERS, chapterId), draft, { merge: true })
      await updateDoc(doc(db, LETTERS, chapterId), {
        sealedAt: serverTimestamp(),
        openAt: openTimestamp,
        updatedAt: serverTimestamp(),
      })
      await updateDoc(doc(db, CHAPTERS, chapterId), {
        letterStatus: 'sealed',
        letterOpenAt: openTimestamp,
        updatedAt: serverTimestamp(),
      })
    },
    [chapter, chapterId, encryptionKey, letter],
  )

  const open = useCallback(async () => {
    await updateDoc(doc(db, LETTERS, chapterId), { openedAt: serverTimestamp() })
    await updateDoc(doc(db, CHAPTERS, chapterId), {
      letterStatus: 'opened',
      letterOpenedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }, [chapterId])

  return { letter, loading, locked, saveDraft, seal, open }
}
