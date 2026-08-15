/**
 * Security-rule tests for the Black Box.
 *
 * The Vault's whole promise is that a capsule addressed to a child's 18th
 * birthday cannot be read before it. That was previously enforced only by
 * isUnlocked() in the client, so any admin could read a sealed letter straight
 * out of the console. It is now enforced by firestore.rules, which means it is
 * only real if it is tested here.
 *
 * Three properties, all load-bearing:
 *
 *   1. A sealed capsule's letter is unreadable — to its own family admins.
 *   2. The metadata the sealed card is built from stays readable, and the *list*
 *      the page runs keeps working with a sealed capsule in it. This is why the
 *      capsule is two documents: on a list operation one denied document fails
 *      the entire listener, so the time condition cannot live on the document
 *      being listed.
 *   3. An unlock date can be pushed further out but never pulled closer. That is
 *      what makes the legacy check-in safe to offer, and what stops anyone
 *      opening a capsule early by editing its date.
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
const ADMIN = 'uid-admin'
const OTHER_ADMIN = 'uid-admin-2'
const OUTSIDER = 'uid-outsider'

const SEALED = 'capsule-sealed'
const OPEN = 'capsule-open'

const future = () => Timestamp.fromDate(new Date(Date.now() + 365 * 86_400_000))
const past = () => Timestamp.fromDate(new Date(Date.now() - 86_400_000))

let testEnv

describe.skipIf(!EMULATOR)('Black Box security rules', () => {
  beforeAll(async () => {
    const [host, port] = EMULATOR.split(':')
    testEnv = await initializeTestEnvironment({
      // Not 'demo-kaydo': these tests wipe the project between cases, and that
      // is the project `npm run seed:emulator` fills with the demo family.
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
      await setDoc(doc(db, 'families', FAMILY), {
        adminUid: ADMIN,
        adminUids: [ADMIN, OTHER_ADMIN],
        familyName: 'Test',
      })

      // One capsule sealed for a year, one already open.
      await setDoc(doc(db, 'blackbox', SEALED), {
        familyId: FAMILY,
        title: 'ciphertext',
        triggerType: 'specificDate',
        unlockDate: future(),
        isSealed: true,
        createdAt: past(),
      })
      await setDoc(doc(db, 'blackboxContent', SEALED), {
        familyId: FAMILY,
        message: 'ciphertext-letter',
        photos: [],
      })

      await setDoc(doc(db, 'blackbox', OPEN), {
        familyId: FAMILY,
        title: 'ciphertext',
        triggerType: 'specificDate',
        unlockDate: past(),
        isSealed: true,
        createdAt: past(),
      })
      await setDoc(doc(db, 'blackboxContent', OPEN), {
        familyId: FAMILY,
        message: 'ciphertext-letter',
        photos: [],
      })
    })
  })

  const as = (uid) => testEnv.authenticatedContext(uid).firestore()

  describe('the seal', () => {
    it('withholds a sealed letter from the family admin who wrote it', async () => {
      const db = as(ADMIN)
      await assertFails(getDoc(doc(db, 'blackboxContent', SEALED)))
    })

    it('withholds it from every other admin too', async () => {
      const db = as(OTHER_ADMIN)
      await assertFails(getDoc(doc(db, 'blackboxContent', SEALED)))
    })

    it('hands over a letter whose date has arrived', async () => {
      const db = as(ADMIN)
      await assertSucceeds(getDoc(doc(db, 'blackboxContent', OPEN)))
    })

    it('withholds an open capsule from someone outside the family', async () => {
      const db = as(OUTSIDER)
      await assertFails(getDoc(doc(db, 'blackboxContent', OPEN)))
    })

    it('withholds a letter whose capsule has no unlock date at all', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore()
        await setDoc(doc(db, 'blackbox', 'no-date'), {
          familyId: FAMILY, title: 'x', triggerType: 'legacy', createdAt: past(),
        })
        await setDoc(doc(db, 'blackboxContent', 'no-date'), {
          familyId: FAMILY, message: 'ciphertext-letter',
        })
      })
      const db = as(ADMIN)
      await assertFails(getDoc(doc(db, 'blackboxContent', 'no-date')))
    })

    it('withholds a letter whose metadata document is gone', async () => {
      // No metadata means no date to check, so the letter must stay shut rather
      // than fall open.
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore()
        await deleteDoc(doc(db, 'blackbox', OPEN))
      })
      const db = as(ADMIN)
      await assertFails(getDoc(doc(db, 'blackboxContent', OPEN)))
    })

    it('reads as absent, not denied, when a capsule predates the split', async () => {
      // This is how the card knows to fall back to the inline fields of an
      // unmigrated capsule instead of showing an error.
      const db = as(ADMIN)
      await assertSucceeds(getDoc(doc(db, 'blackboxContent', 'never-created')))
    })
  })

  describe('the metadata the sealed card is built from', () => {
    it('stays readable while the capsule is sealed', async () => {
      const db = as(ADMIN)
      const snap = await assertSucceeds(getDoc(doc(db, 'blackbox', SEALED)))
      expect(snap.data().unlockDate).toBeTruthy()
    })

    it('lists both capsules, sealed and open, in one query', async () => {
      // The reason for the split. A time condition on this collection would deny
      // one document in the result set, and a list fails wholesale — the page
      // would go blank for any family holding a sealed capsule.
      const db = as(ADMIN)
      const snap = await assertSucceeds(
        getDocs(query(
          collection(db, 'blackbox'),
          where('familyId', '==', FAMILY),
          orderBy('createdAt', 'desc'),
        )),
      )
      expect(snap.docs.map((d) => d.id).sort()).toEqual([OPEN, SEALED].sort())
    })

    it('is not readable by someone outside the family', async () => {
      const db = as(OUTSIDER)
      await assertFails(getDoc(doc(db, 'blackbox', SEALED)))
    })
  })

  describe('the unlock date', () => {
    it('can be pushed further out — this is the legacy check-in', async () => {
      const db = as(ADMIN)
      const later = Timestamp.fromDate(new Date(Date.now() + 730 * 86_400_000))
      await assertSucceeds(updateDoc(doc(db, 'blackbox', SEALED), { unlockDate: later }))
    })

    it('cannot be pulled closer', async () => {
      const db = as(ADMIN)
      const sooner = Timestamp.fromDate(new Date(Date.now() + 86_400_000))
      await assertFails(updateDoc(doc(db, 'blackbox', SEALED), { unlockDate: sooner }))
    })

    it('cannot be moved into the past to open a capsule early', async () => {
      // The attack the client-side check could not stop.
      const db = as(ADMIN)
      await assertFails(updateDoc(doc(db, 'blackbox', SEALED), { unlockDate: past() }))
    })

    it('lets other fields be edited without touching the date', async () => {
      const db = as(ADMIN)
      await assertSucceeds(updateDoc(doc(db, 'blackbox', SEALED), { title: 'new ciphertext' }))
    })

    it('cannot be moved by someone outside the family', async () => {
      const db = as(OUTSIDER)
      await assertFails(updateDoc(doc(db, 'blackbox', SEALED), { unlockDate: future() }))
    })
  })

  describe('the letter itself', () => {
    it('cannot be rewritten while the capsule is sealed', async () => {
      const db = as(ADMIN)
      await assertFails(updateDoc(doc(db, 'blackboxContent', SEALED), { message: 'tampered' }))
    })

    it('can be edited once the capsule has opened', async () => {
      const db = as(ADMIN)
      await assertSucceeds(updateDoc(doc(db, 'blackboxContent', OPEN), { message: 'ciphertext-2' }))
    })

    it('can be deleted while sealed, so a capsule can be discarded', async () => {
      // Waiting years to throw something away would be absurd, and the UI's
      // delete has to remove both halves.
      const db = as(ADMIN)
      await assertSucceeds(deleteDoc(doc(db, 'blackboxContent', SEALED)))
    })

    it('cannot be created by someone outside the family', async () => {
      const db = as(OUTSIDER)
      await assertFails(
        setDoc(doc(db, 'blackboxContent', 'new'), { familyId: FAMILY, message: 'x' }),
      )
    })

    it('can be created by a family admin, since sealing writes it', async () => {
      const db = as(ADMIN)
      await assertSucceeds(
        setDoc(doc(db, 'blackboxContent', 'new'), { familyId: FAMILY, message: 'ciphertext' }),
      )
    })
  })
})
