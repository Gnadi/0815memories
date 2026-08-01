/**
 * Security-rule tests for "Our Year".
 *
 * The feature makes two promises that are worth more than a UI convention:
 * neither partner can read the other's answers before both have handed in, and
 * a sealed letter cannot be read before the day the couple chose. Both are
 * enforced in firestore.rules, so both are tested here against the emulator.
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  Timestamp,
} from 'firebase/firestore'
import { readFileSync } from 'node:fs'

// Set by `firebase emulators:exec`; absent during a plain `npm test`.
const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

const FAMILY = 'family-1'
const A = 'uid-a'
const B = 'uid-b'
const OUTSIDER = 'uid-c'
const PARTICIPANTS = [A, B]
const CHAPTER = 'chapter-1'

let testEnv

const entry = (uid, overrides = {}) => ({
  familyId: FAMILY,
  chapterId: CHAPTER,
  participantUids: PARTICIPANTS,
  authorUid: uid,
  kind: 'reflection',
  answers: 'ciphertext',
  submitted: true,
  revealed: false,
  ...overrides,
})

const entryPath = (uid) => `ourYearEntries/${CHAPTER}_reflection_${uid}`

describe.skipIf(!EMULATOR)('Our Year security rules', () => {
  beforeAll(async () => {
    const [host, port] = EMULATOR.split(':')
    testEnv = await initializeTestEnvironment({
      // Deliberately NOT 'demo-kaydo': these tests wipe the project between
      // cases, and that is the project `npm run seed:emulator` fills with the
      // demo family used for the landing-page screenshots.
      projectId: 'demo-kaydo-rules',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
    })
  })

  afterAll(async () => {
    await testEnv?.cleanup()
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      // All three are admins of the same family — only two of them are the couple.
      await setDoc(doc(db, 'families', FAMILY), {
        adminUid: A,
        adminUids: [A, B, OUTSIDER],
        familyName: 'Test',
      })
      await setDoc(doc(db, 'ourYearRituals/ritual-1'), {
        familyId: FAMILY,
        participantUids: PARTICIPANTS,
        occasionKey: 'firstMet',
        rhythm: 'manual',
      })
      await setDoc(doc(db, 'ourYearChapters', CHAPTER), {
        familyId: FAMILY,
        ritualId: 'ritual-1',
        participantUids: PARTICIPANTS,
        title: 'ciphertext',
        status: 'open',
        letterStatus: 'none',
      })
    })
  })

  const as = (uid) => testEnv.authenticatedContext(uid).firestore()

  // Queries, not just single-document reads. A `list` is evaluated differently:
  // reaching straight into a field throws during the engine's validation pass,
  // which denied the whole chapter timeline until the rules used `.get()` with a
  // default. Single-document tests never caught it.
  describe('listing chapters', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await updateDoc(doc(context.firestore(), 'ourYearChapters', CHAPTER), {
          periodStart: Timestamp.fromDate(new Date(2025, 4, 13)),
        })
      })
    })

    it('lets a partner query their own timeline', async () => {
      const snap = await assertSucceeds(
        getDocs(
          query(
            collection(as(A), 'ourYearChapters'),
            where('participantUids', 'array-contains', A),
            where('ritualId', '==', 'ritual-1'),
            orderBy('periodStart', 'desc'),
          ),
        ),
      )
      expect(snap.size).toBe(1)
    })

    it('rejects a query that does not constrain itself to the asker', async () => {
      // Not a leak, a design constraint: rules are not filters, so a list is
      // refused outright unless the query proves the read rule holds. This is
      // why useOurYearChapters always filters on participantUids.
      await assertFails(
        getDocs(
          query(collection(as(A), 'ourYearChapters'), where('ritualId', '==', 'ritual-1')),
        ),
      )
    })

    it('refuses a third admin asking for the couple by name', async () => {
      await assertFails(
        getDocs(
          query(
            collection(as(OUTSIDER), 'ourYearChapters'),
            where('participantUids', 'array-contains', A),
            where('ritualId', '==', 'ritual-1'),
          ),
        ),
      )
    })

    it('hands a third admin nothing when they ask about themselves', async () => {
      // Constraining the query to their own uid is allowed — and returns an
      // empty set, because they are in nobody's ritual.
      const snap = await assertSucceeds(
        getDocs(
          query(
            collection(as(OUTSIDER), 'ourYearChapters'),
            where('participantUids', 'array-contains', OUTSIDER),
          ),
        ),
      )
      expect(snap.size).toBe(0)
    })

    it('lets a partner find their ritual by membership', async () => {
      const snap = await assertSucceeds(
        getDocs(
          query(collection(as(B), 'ourYearRituals'), where('participantUids', 'array-contains', B)),
        ),
      )
      expect(snap.size).toBe(1)
    })
  })

  describe('a third admin of the same family', () => {
    it('cannot read the ritual, the chapter, or any answer', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), entryPath(A)), entry(A))
      })
      const db = as(OUTSIDER)
      await assertFails(getDoc(doc(db, 'ourYearRituals/ritual-1')))
      await assertFails(getDoc(doc(db, 'ourYearChapters', CHAPTER)))
      await assertFails(getDoc(doc(db, entryPath(A))))
    })
  })

  describe('answers before the reveal', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), entryPath(A)), entry(A))
      })
    })

    it('lets the author read their own', async () => {
      await assertSucceeds(getDoc(doc(as(A), entryPath(A))))
    })

    it('does not let the partner read them', async () => {
      await assertFails(getDoc(doc(as(B), entryPath(A))))
    })

    it('does not let the partner edit them', async () => {
      await assertFails(updateDoc(doc(as(B), entryPath(A)), { answers: 'tampered' }))
    })

    it('lets the partner set nothing but `revealed`', async () => {
      await assertFails(
        updateDoc(doc(as(B), entryPath(A)), { revealed: true, answers: 'tampered' }),
      )
      await assertSucceeds(updateDoc(doc(as(B), entryPath(A)), { revealed: true }))
    })

    it('opens the answers to both once revealed', async () => {
      await updateDoc(doc(as(B), entryPath(A)), { revealed: true })
      await assertSucceeds(getDoc(doc(as(B), entryPath(A))))
      await assertFails(getDoc(doc(as(OUTSIDER), entryPath(A))))
    })

    it('lets either partner discard an answer when a chapter is thrown away', async () => {
      await assertSucceeds(deleteDoc(doc(as(B), entryPath(A))))
    })
  })

  it('lets a partner watch their own answer sheet before it exists', async () => {
    // The client subscribes to its own entry before anything is written.
    // Denying that read would leave the listener dead, so a later submit would
    // never show up.
    await assertSucceeds(getDoc(doc(as(A), entryPath(A))))
    await assertSucceeds(getDoc(doc(as(A), `ourYearLetters/${CHAPTER}`)))
  })

  describe('the sealed letter', () => {
    const letterPath = `ourYearLetters/${CHAPTER}`

    const seedLetter = (openAt, sealed = true) =>
      testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), letterPath), {
          familyId: FAMILY,
          chapterId: CHAPTER,
          participantUids: PARTICIPANTS,
          sections: 'ciphertext',
          sealedAt: sealed ? Timestamp.fromDate(new Date(2026, 0, 1)) : null,
          openAt: openAt ? Timestamp.fromDate(openAt) : null,
          openedAt: null,
        })
      })

    it('is readable and editable while it is still a draft', async () => {
      await seedLetter(null, false)
      await assertSucceeds(getDoc(doc(as(A), letterPath)))
      await assertSucceeds(updateDoc(doc(as(A), letterPath), { sections: 'more' }))
    })

    it('cannot be read by either partner before the chosen day', async () => {
      await seedLetter(new Date(Date.now() + 30 * 24 * 3600 * 1000))
      await assertFails(getDoc(doc(as(A), letterPath)))
      await assertFails(getDoc(doc(as(B), letterPath)))
    })

    it('cannot be unsealed or altered before the chosen day', async () => {
      await seedLetter(new Date(Date.now() + 30 * 24 * 3600 * 1000))
      await assertFails(updateDoc(doc(as(A), letterPath), { sealedAt: null }))
      await assertFails(
        updateDoc(doc(as(A), letterPath), { openAt: Timestamp.fromDate(new Date(2020, 0, 1)) }),
      )
    })

    it('opens to both partners once the day has arrived', async () => {
      await seedLetter(new Date(Date.now() - 1000))
      await assertSucceeds(getDoc(doc(as(A), letterPath)))
      await assertSucceeds(getDoc(doc(as(B), letterPath)))
      await assertFails(getDoc(doc(as(OUTSIDER), letterPath)))
    })

    it('cannot be created already sealed — the text has to land first', async () => {
      const db = as(A)
      await assertFails(
        setDoc(doc(db, letterPath), {
          familyId: FAMILY,
          chapterId: CHAPTER,
          participantUids: PARTICIPANTS,
          sections: 'ciphertext',
          sealedAt: Timestamp.now(),
          openAt: Timestamp.fromDate(new Date(2030, 0, 1)),
        }),
      )
    })
  })

  describe('a closed chapter', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await updateDoc(doc(context.firestore(), 'ourYearChapters', CHAPTER), {
          status: 'closed',
          letterStatus: 'sealed',
        })
      })
    })

    it('cannot be edited any more', async () => {
      await assertFails(
        updateDoc(doc(as(A), 'ourYearChapters', CHAPTER), { title: 'rewritten' }),
      )
      await assertFails(
        updateDoc(doc(as(A), 'ourYearChapters', CHAPTER), { status: 'open' }),
      )
    })

    it('still allows a letter written back then to be opened', async () => {
      await assertSucceeds(
        updateDoc(doc(as(A), 'ourYearChapters', CHAPTER), {
          letterStatus: 'opened',
          letterOpenedAt: Timestamp.now(),
        }),
      )
    })
  })

  describe('the ritual', () => {
    it('cannot be handed to somebody else', async () => {
      await assertFails(
        updateDoc(doc(as(A), 'ourYearRituals/ritual-1'), { participantUids: [A, OUTSIDER] }),
      )
    })

    it('accepts ordinary edits from either partner', async () => {
      await assertSucceeds(
        updateDoc(doc(as(B), 'ourYearRituals/ritual-1'), { occasionKey: 'newYear' }),
      )
    })

    it('needs exactly two people to exist at all', async () => {
      await assertFails(
        setDoc(doc(as(A), 'ourYearRituals/ritual-2'), {
          familyId: FAMILY,
          participantUids: [A],
          rhythm: 'manual',
        }),
      )
    })
  })
})
