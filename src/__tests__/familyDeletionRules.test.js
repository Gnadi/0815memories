/**
 * Security-rule tests for a family's deletion date.
 *
 * `deletion` on the family document says when the family is deleted, and the
 * daily run of functions/familyDeletion.js acts on it. Only the owner may set
 * or clear it, through the functions. So no client writes it, whoever they
 * are and however the write is dressed up — every way of updating the family
 * document is tried here, because one of them not asking would be enough.
 *
 * The last test runs the functions themselves against the emulator: the query
 * the daily run finds its families with, on real timestamps.
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
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import {
  cancelDeletion,
  deleteFamily,
  familiesToDelete,
  requestDeletion,
  FAMILY_DELETIONS,
} from '../../functions/familyDeletion.js'

// Set by `firebase emulators:exec`; absent during a plain `npm test`.
const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

const FAMILY = 'family-1'
const OWNER = 'uid-owner'
const CO_ADMIN = 'uid-co-admin'
const DAY = 24 * 60 * 60 * 1000

const KEY = { k: 'the-secret-key', kty: 'oct' }
const inTwoWeeks = () => ({
  requestedBy: OWNER,
  requestedAt: Timestamp.now(),
  deleteAfter: Timestamp.fromMillis(Date.now() + 14 * DAY),
})

let testEnv
let adminApp
let adminDb

const as = (uid) => testEnv.authenticatedContext(uid, { email_verified: true }).firestore()
const family = (db) => doc(db, 'families', FAMILY)

const seed = (extra = {}) =>
  testEnv.withSecurityRulesDisabled((ctx) =>
    setDoc(family(ctx.firestore()), {
      adminUid: OWNER,
      adminUids: [OWNER, CO_ADMIN],
      familyName: 'The Millers',
      familySlug: 'the-millers',
      encryptionKeyJwk: KEY,
      ...extra,
    }),
  )

describe.skipIf(!EMULATOR)('family deletion rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-kaydo-family-deletion-rules',
      firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    })
    adminApp = initializeApp({ projectId: 'demo-kaydo-family-deletion-rules' }, 'family-deletion-rules')
    adminDb = getFirestore(adminApp)
  })

  afterAll(async () => {
    await testEnv?.cleanup()
    if (adminApp) await deleteApp(adminApp)
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
  })

  it('lets no client schedule a deletion, the owner included', async () => {
    await seed()
    for (const uid of [OWNER, CO_ADMIN]) {
      await assertFails(updateDoc(family(as(uid)), { deletion: inTwoWeeks() }))
      await assertFails(setDoc(family(as(uid)), { deletion: inTwoWeeks() }, { merge: true }))
    }
    // Still free to change what an admin may change.
    await assertSucceeds(updateDoc(family(as(CO_ADMIN)), { familyName: 'The Millers!' }))
  })

  it('lets no client take a scheduled deletion back, or move its date', async () => {
    await seed({ deletion: inTwoWeeks() })
    for (const uid of [OWNER, CO_ADMIN]) {
      await assertFails(updateDoc(family(as(uid)), { deletion: null }))
      await assertFails(updateDoc(family(as(uid)), { deletion: deleteField() }))
      await assertFails(updateDoc(family(as(uid)), { 'deletion.deleteAfter': Timestamp.fromMillis(Date.now() + 365 * DAY) }))
      await assertFails(updateDoc(family(as(uid)), { 'deletion.deleteAfter': Timestamp.fromMillis(0) }))
    }
    // The date does not get in the way of an ordinary edit.
    await assertSucceeds(updateDoc(family(as(OWNER)), { familyName: 'The Millers!' }))
  })

  it('refuses a family founded with a deletion date', async () => {
    const founding = { adminUid: 'uid-new', adminUids: ['uid-new'], familyName: 'New', encryptionKeyJwk: KEY }
    await assertFails(setDoc(doc(as('uid-new'), 'families', 'family-new'), { ...founding, deletion: inTwoWeeks() }))
    await assertSucceeds(setDoc(doc(as('uid-new'), 'families', 'family-new'), founding))
  })

  it('still lets nobody delete the family document', async () => {
    await seed({ deletion: inTwoWeeks() })
    await assertFails(deleteDoc(family(as(OWNER))))
  })

  it('keeps the markers of running deletions from every client', async () => {
    await seed()
    await testEnv.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), FAMILY_DELETIONS, FAMILY), { ownerUid: OWNER }),
    )
    await assertFails(getDoc(doc(as(OWNER), FAMILY_DELETIONS, FAMILY)))
    await assertFails(setDoc(doc(as(OWNER), FAMILY_DELETIONS, FAMILY), { ownerUid: OWNER }))
    await assertFails(deleteDoc(doc(as(OWNER), FAMILY_DELETIONS, FAMILY)))
  })

  it('schedules, finds, takes back and carries out a deletion with real queries', async () => {
    await seed()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'memories', 'mem-1'), { familyId: FAMILY })
      await setDoc(doc(ctx.firestore(), 'memories', 'mem-other'), { familyId: 'family-2' })
      await setDoc(doc(ctx.firestore(), 'families', 'family-2'), { adminUid: 'uid-2', adminUids: ['uid-2'], encryptionKeyJwk: KEY })
    })
    const deps = { db: adminDb }

    await requestDeletion(deps, OWNER, { familyId: FAMILY })
    // A member reads the date with the family document; that is how the app shows it.
    expect((await getDoc(family(as(CO_ADMIN)))).data().deletion.requestedBy).toBe(OWNER)
    expect(await familiesToDelete(adminDb, Date.now())).toEqual([])
    expect(await familiesToDelete(adminDb, Date.now() + 15 * DAY)).toEqual([FAMILY])

    await cancelDeletion(deps, OWNER, { familyId: FAMILY })
    expect(await familiesToDelete(adminDb, Date.now() + 15 * DAY)).toEqual([])

    await requestDeletion(deps, OWNER, { familyId: FAMILY })
    const deleted = []
    const stats = await deleteFamily(
      {
        db: adminDb,
        bucket: { getFiles: async () => [[]] },
        auth: { deleteUser: async (uid) => { deleted.push(uid) } },
        destroy: async (_type, ids) => new Set(ids),
        now: () => Date.now() + 15 * DAY,
      },
      FAMILY,
    )
    expect(stats).toMatchObject({ outcome: 'deleted', documents: 1 })
    expect(deleted).toEqual([`viewer:${FAMILY}`, OWNER])
    expect((await adminDb.doc(`families/${FAMILY}`).get()).exists).toBe(false)
    expect((await adminDb.doc('memories/mem-1').get()).exists).toBe(false)
    expect((await adminDb.doc('memories/mem-other').get()).exists).toBe(true)
    expect((await adminDb.doc('families/family-2').get()).exists).toBe(true)
    expect(await familiesToDelete(adminDb, Date.now() + 15 * DAY)).toEqual([])
  })
})
