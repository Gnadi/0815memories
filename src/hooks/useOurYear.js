import { useState, useEffect, useCallback, useMemo } from 'react'
import { db } from '../config/firebase'
import { devError } from '../utils/devLog'
import { bothSubmitted, isLetterLocked, isRevealed } from '../utils/ourYear'
import {
  addChapter,
  closeChapter,
  createRitual,
  deleteChapter,
  markRevealed,
  markSubmitted,
  openLetter,
  revealEntries,
  saveLetterDraft,
  sealLetter,
  subscribeChapter,
  subscribeChapters,
  subscribeEntry,
  subscribeLetter,
  subscribeRitual,
  updateChapter,
  updateRitual,
  writeEntry,
} from '../services/ourYear'

// "Our Year"'s state. What is stored, and who may read it, is in
// services/ourYear.js.

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
    return subscribeRitual(familyId, uid, encryptionKey, (found) => {
      setRitual(found)
      setLoading(false)
    }, (error) => {
      devError('Failed to load the Our Year ritual:', error)
      setLoading(false)
    })
  }, [familyId, uid, encryptionKey])

  const create = useCallback(
    (data) => createRitual(familyId, uid, encryptionKey, data),
    [familyId, uid, encryptionKey],
  )

  const update = useCallback(
    (id, data) => updateRitual(encryptionKey, id, data),
    [encryptionKey],
  )

  return { ritual, loading, createRitual: create, updateRitual: update }
}

// ---------------------------------------------------------------------------
// Chapters
// ---------------------------------------------------------------------------

/** The couple's chapters, newest first. */
export function useOurYearChapters(ritualId, uid, encryptionKey) {
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ritualId || !uid || !db) {
      setChapters([])
      setLoading(false)
      return
    }
    return subscribeChapters(ritualId, uid, encryptionKey, (list) => {
      setChapters(list)
      setLoading(false)
    }, (error) => {
      devError('Failed to load Our Year chapters:', error)
      setLoading(false)
    })
  }, [ritualId, uid, encryptionKey])

  const add = useCallback(
    (ritual, data) => addChapter(encryptionKey, ritual, data),
    [encryptionKey],
  )

  const update = useCallback(
    (id, data) => updateChapter(encryptionKey, id, data),
    [encryptionKey],
  )

  return { chapters, loading, addChapter: add, updateChapter: update, deleteChapter }
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
    return subscribeChapter(chapterId, encryptionKey, (found) => {
      setChapter(found)
      setMissing(!found)
      setLoading(false)
    }, (error) => {
      devError('Failed to load the Our Year chapter:', error)
      setMissing(true)
      setLoading(false)
    })
  }, [chapterId, encryptionKey])

  const update = useCallback(
    (data) => updateChapter(encryptionKey, chapterId, data),
    [chapterId, encryptionKey],
  )

  const close = useCallback(() => closeChapter(chapterId), [chapterId])

  return { chapter, loading, missing, updateChapter: update, closeChapter: close }
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

  useEffect(() => {
    if (!chapterId || !uid || !db) {
      setLoading(false)
      return
    }
    return subscribeEntry(chapterId, kind, uid, encryptionKey, (entry) => {
      setOwn(entry)
      setLoading(false)
    }, (error) => {
      devError('Failed to load your Our Year answers:', error)
      setLoading(false)
    })
  }, [chapterId, kind, uid, encryptionKey])

  useEffect(() => {
    if (!chapterId || !partnerUid || !revealed || !db) {
      setPartner(null)
      return
    }
    return subscribeEntry(chapterId, kind, partnerUid, encryptionKey, setPartner, (error) => {
      devError('Failed to load your partner\'s Our Year answers:', error)
    })
  }, [chapterId, kind, partnerUid, revealed, encryptionKey])

  const writeOwn = useCallback(
    (answers, submitted) =>
      writeEntry(encryptionKey, { chapter, kind, uid, answers, submitted, exists: !!own }),
    [chapter, kind, uid, encryptionKey, own],
  )

  const saveDraft = useCallback((answers) => writeOwn(answers, false), [writeOwn])

  /** Hands in this person's part. From here on it is fixed. */
  const submit = useCallback(
    async (answers) => {
      await writeOwn(answers, true)
      await markSubmitted(chapterId, kind, uid)
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
        await markRevealed(chapterId, kind)
        if (cancelled) return
        await revealEntries(chapterId, kind, participantUids)
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
    return subscribeLetter(chapterId, encryptionKey, (found) => {
      setLetter(found)
      setLoading(false)
    }, (error) => {
      devError('Failed to load the Our Year letter:', error)
      setLoading(false)
    })
  }, [chapterId, locked, encryptionKey])

  const saveDraft = useCallback(
    (sections) => saveLetterDraft(encryptionKey, { chapter, sections, exists: !!letter }),
    [chapter, encryptionKey, letter],
  )

  const seal = useCallback(
    (sections, openAt) => sealLetter(encryptionKey, { chapter, sections, openAt, exists: !!letter }),
    [chapter, encryptionKey, letter],
  )

  const open = useCallback(() => openLetter(chapterId), [chapterId])

  return { letter, loading, locked, saveDraft, seal, open }
}
