/**
 * Security-rule tests for the trash.
 *
 * Deleting moves a document into trash/<collection>__<id>, and restoring moves
 * it back. Both moves write documents the collections' own rules would
 * otherwise check, so the trash rules have to hold them to the same document,
 * byte for byte — or the trash becomes the way around those rules. A capsule
 * restored with an earlier unlock date would open early.
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  writeBatch,
  Timestamp,
} from 'firebase/firestore'
import { readFileSync } from 'node:fs'

// Set by `firebase emulators:exec`; absent during a plain `npm test`.
const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

const FAMILY = 'family-1'
const OTHER_FAMILY = 'family-2'
const ADMIN = 'uid-admin'
const OTHER_ADMIN = 'uid-admin-2'
const STRANGER = 'uid-stranger'

const MEMORY = {
  familyId: FAMILY,
  title: 'ciphertext-title',
  images: ['https://res.cloudinary.com/kaydo/raw/upload/v1/kaydo/f/family-1/encrypted/a.dat'],
  date: Timestamp.fromDate(new Date('2024-07-01T10:00:00Z')),
}

const future = () => Timestamp.fromDate(new Date(Date.now() + 365 * 86_400_000))

let testEnv

describe.skipIf(!EMULATOR)('Trash security rules', () => {
  beforeAll(async () => {
    const [host, port] = EMULATOR.split(':')
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-kaydo-trash-rules',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
    })
  })

  afterAll(async () => {
    await testEnv?.cleanup()
  })

  const capsuleDate = future()

  beforeEach(async () => {
    await testEnv.clearFirestore()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'families', FAMILY), { adminUid: ADMIN, adminUids: [ADMIN, OTHER_ADMIN], familyName: 'Test' })
      await setDoc(doc(db, 'families', OTHER_FAMILY), { adminUid: STRANGER, adminUids: [STRANGER], familyName: 'Other' })
      await setDoc(doc(db, 'memories', 'm1'), MEMORY)
      await setDoc(doc(db, 'blackbox', 'c1'), {
        familyId: FAMILY, title: 'ciphertext', triggerType: 'specificDate', unlockDate: capsuleDate, isSealed: true,
      })
      await setDoc(doc(db, 'blackboxContent', 'c1'), { familyId: FAMILY, message: 'ciphertext-letter', photos: [] })
    })
  })

  const as = (uid) => testEnv.authenticatedContext(uid).firestore()
  const asViewer = () =>
    testEnv.authenticatedContext(`viewer:${FAMILY}`, { role: 'viewer', familyId: FAMILY }).firestore()

  const entryOf = (collectionName, docId, data, overrides = {}) => ({
    familyId: FAMILY,
    collection: collectionName,
    docId,
    data,
    group: `${collectionName}__${docId}`,
    media: [],
    deletedAt: serverTimestamp(),
    deletedBy: ADMIN,
    ...overrides,
  })

  /** What services/trash.js commits: the entry in, the document out. */
  function moveBatch(db, collectionName, docId, data, overrides = {}, { entryId, keepOriginal = false } = {}) {
    const batch = writeBatch(db)
    batch.set(doc(db, 'trash', entryId ?? `${collectionName}__${docId}`), entryOf(collectionName, docId, data, overrides))
    if (!keepOriginal) batch.delete(doc(db, collectionName, docId))
    return batch.commit()
  }

  async function seedEntry(collectionName, docId, data) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'trash', `${collectionName}__${docId}`), {
        ...entryOf(collectionName, docId, data), deletedAt: Timestamp.now(),
      })
      await deleteDoc(doc(db, collectionName, docId))
    })
  }

  function restoreBatch(db, collectionName, docId, data) {
    const batch = writeBatch(db)
    batch.set(doc(db, collectionName, docId), data)
    batch.delete(doc(db, 'trash', `${collectionName}__${docId}`))
    return batch.commit()
  }

  describe('moving in', () => {
    it('lets an admin move a document in exactly as it was stored', async () => {
      await assertSucceeds(moveBatch(as(ADMIN), 'memories', 'm1', MEMORY))
    })

    it('refuses a copy that is not the document', async () => {
      await assertFails(moveBatch(as(ADMIN), 'memories', 'm1', { ...MEMORY, title: 'something else' }))
    })

    it('refuses an entry for a document that stays where it is', async () => {
      await assertFails(moveBatch(as(ADMIN), 'memories', 'm1', MEMORY, {}, { keepOriginal: true }))
    })

    it('refuses an entry filed under another name or another family', async () => {
      await assertFails(moveBatch(as(ADMIN), 'memories', 'm1', MEMORY, {}, { entryId: 'memories__other' }))
      await assertFails(moveBatch(as(ADMIN), 'memories', 'm1', MEMORY, { familyId: OTHER_FAMILY }))
    })

    it('refuses a backdated deletion, a borrowed name, and extra fields', async () => {
      await assertFails(moveBatch(as(ADMIN), 'memories', 'm1', MEMORY, { deletedAt: Timestamp.fromDate(new Date('2020-01-01')) }))
      await assertFails(moveBatch(as(ADMIN), 'memories', 'm1', MEMORY, { deletedBy: OTHER_ADMIN }))
      await assertFails(moveBatch(as(ADMIN), 'memories', 'm1', MEMORY, { purgeNow: true }))
    })

    it('refuses viewers, and admins of another family', async () => {
      await assertFails(moveBatch(asViewer(), 'memories', 'm1', MEMORY, { deletedBy: `viewer:${FAMILY}` }))
      await assertFails(moveBatch(as(STRANGER), 'memories', 'm1', MEMORY, { deletedBy: STRANGER }))
    })

    it('takes only the collections that have a trash', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'ourYearChapters', 'ch1'), { familyId: FAMILY, participantUids: [ADMIN] })
      })
      await assertFails(moveBatch(as(ADMIN), 'ourYearChapters', 'ch1', { familyId: FAMILY, participantUids: [ADMIN] }))
    })
  })

  describe('reading and deleting for good', () => {
    beforeEach(() => seedEntry('memories', 'm1', MEMORY))

    it("shows a family's trash to its admins only", async () => {
      await assertSucceeds(getDoc(doc(as(OTHER_ADMIN), 'trash', 'memories__m1')))
      await assertSucceeds(getDocs(query(collection(as(ADMIN), 'trash'), where('familyId', '==', FAMILY))))
      await assertFails(getDoc(doc(asViewer(), 'trash', 'memories__m1')))
      await assertFails(getDoc(doc(as(STRANGER), 'trash', 'memories__m1')))
    })

    it('takes "delete for good", and no other change', async () => {
      await assertFails(updateDoc(doc(as(ADMIN), 'trash', 'memories__m1'), { 'data.title': 'rewritten' }))
      await assertFails(updateDoc(doc(as(ADMIN), 'trash', 'memories__m1'), { purgeNow: false }))
      await assertFails(updateDoc(doc(as(STRANGER), 'trash', 'memories__m1'), { purgeNow: true }))
      await assertSucceeds(updateDoc(doc(as(ADMIN), 'trash', 'memories__m1'), { purgeNow: true }))
    })

    it('leaves deleting an entry to the server, short of restoring it', async () => {
      await assertFails(deleteDoc(doc(as(ADMIN), 'trash', 'memories__m1')))
    })
  })

  describe('restoring', () => {
    beforeEach(() => seedEntry('memories', 'm1', MEMORY))

    it('puts the document back as it was', async () => {
      await assertSucceeds(restoreBatch(as(ADMIN), 'memories', 'm1', MEMORY))
    })

    it('refuses to put anything else back in its place', async () => {
      await assertFails(restoreBatch(as(ADMIN), 'memories', 'm1', { ...MEMORY, title: 'rewritten' }))
    })

    it('refuses viewers and other families', async () => {
      await assertFails(restoreBatch(asViewer(), 'memories', 'm1', MEMORY))
      await assertFails(restoreBatch(as(STRANGER), 'memories', 'm1', MEMORY))
    })
  })

  // Each entry costs the rules document reads, and a batch gets twenty. The
  // trash moves five documents per batch (BATCH_SIZE in services/trash.js):
  // a child with a long journal must still fit, both ways.
  describe('a full batch', () => {
    const ids = ['k1', 'j1', 'j2', 'j3', 'j4']
    const dataOf = (id) => (id === 'k1'
      ? { familyId: FAMILY, name: 'ciphertext-name' }
      : { familyId: FAMILY, childId: 'k1', content: `ciphertext-${id}` })
    const collectionOf = (id) => (id === 'k1' ? 'children' : 'journals')

    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        for (const id of ids) await setDoc(doc(context.firestore(), collectionOf(id), id), dataOf(id))
      })
    })

    it('moves five documents in and back out in one batch each', async () => {
      const db = as(ADMIN)
      const into = writeBatch(db)
      for (const id of ids) {
        into.set(doc(db, 'trash', `${collectionOf(id)}__${id}`), entryOf(collectionOf(id), id, dataOf(id), { group: 'children__k1' }))
        into.delete(doc(db, collectionOf(id), id))
      }
      await assertSucceeds(into.commit())

      const back = writeBatch(db)
      for (const id of ids) {
        back.set(doc(db, collectionOf(id), id), dataOf(id))
        back.delete(doc(db, 'trash', `${collectionOf(id)}__${id}`))
      }
      await assertSucceeds(back.commit())
    })
  })

  describe('a capsule', () => {
    const capsule = () => ({
      familyId: FAMILY, title: 'ciphertext', triggerType: 'specificDate', unlockDate: capsuleDate, isSealed: true,
    })

    it('moves without its letter, which stays sealed', async () => {
      await assertSucceeds(moveBatch(as(ADMIN), 'blackbox', 'c1', capsule()))
      await assertFails(getDoc(doc(as(ADMIN), 'blackboxContent', 'c1')))
    })

    it('comes back to its letter with the date it went in with, and no earlier one', async () => {
      await seedEntry('blackbox', 'c1', capsule())
      const earlier = { ...capsule(), unlockDate: Timestamp.fromDate(new Date(Date.now() - 86_400_000)) }
      await assertFails(restoreBatch(as(ADMIN), 'blackbox', 'c1', earlier))
      await assertFails(setDoc(doc(as(ADMIN), 'blackbox', 'c1'), earlier))
      await assertSucceeds(restoreBatch(as(ADMIN), 'blackbox', 'c1', capsule()))
      await assertFails(getDoc(doc(as(ADMIN), 'blackboxContent', 'c1')))
    })
  })

  describe('deletion requests and family deletions', () => {
    const request = (overrides = {}) => ({
      familyId: FAMILY,
      media: ['https://res.cloudinary.com/kaydo/raw/upload/v1/kaydo/f/family-1/encrypted/k.dat'],
      requestedAt: serverTimestamp(),
      requestedBy: ADMIN,
      ...overrides,
    })

    it("takes an admin's request for their own family, and shows it to nobody", async () => {
      const ref = await assertSucceeds(addDoc(collection(as(ADMIN), 'mediaDeletions'), request()))
      await assertFails(getDoc(doc(as(ADMIN), 'mediaDeletions', ref.id)))
    })

    it('refuses requests from outside the family, or out of shape', async () => {
      await assertFails(addDoc(collection(as(STRANGER), 'mediaDeletions'), request({ requestedBy: STRANGER })))
      await assertFails(addDoc(collection(asViewer(), 'mediaDeletions'), request({ requestedBy: `viewer:${FAMILY}` })))
      await assertFails(addDoc(collection(as(ADMIN), 'mediaDeletions'), request({ media: [] })))
      await assertFails(addDoc(collection(as(ADMIN), 'mediaDeletions'), request({ media: Array(51).fill('x') })))
    })

    it('keeps a family deletion, and the key it holds, from every client', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'familyDeletions', FAMILY), { key: { k: 'secret' } })
      })
      await assertFails(getDoc(doc(as(ADMIN), 'familyDeletions', FAMILY)))
      await assertFails(setDoc(doc(as(ADMIN), 'familyDeletions', FAMILY), { key: null }))
    })
  })
})
