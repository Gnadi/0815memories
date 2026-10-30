// @vitest-environment node
/**
 * The media ledger — functions/mediaSigning.js against the emulator.
 *
 * `mediaAssets` will decide which Cloudinary files are deleted, so no client
 * may read or write it: not a stranger, and not an admin of the family a file
 * belongs to either. Only the Admin SDK writes it, here through signUpload.
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { MEDIA_ASSETS, MEDIA_RATES, MEDIA_USAGE, signUpload } from '../../functions/mediaSigning.js'
import { syncMediaSizes } from '../../functions/mediaSizes.js'
import { purgeMedia } from '../../functions/mediaPurge.js'
import { inventoryLegacyMedia, MEDIA_REPORTS } from '../../functions/mediaInventory.js'

// Set by `firebase emulators:exec`; absent during a plain `npm test`.
const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST
const FAMILY = 'fam-a'
const ADMIN = 'uid-admin'
const LIMITS = { uploadsPerHour: 100, familyBytes: 10 * 1024 * 1024, maxFileBytes: 1024 * 1024 }

let testEnv
let adminApp
let db

describe.skipIf(!EMULATOR)('media ledger', () => {
  beforeAll(async () => {
    const [host, port] = EMULATOR.split(':')
    testEnv = await initializeTestEnvironment({
      // Its own project: clearFirestore() wipes the whole project, and vitest
      // runs the rules suites in parallel.
      projectId: 'demo-kaydo-media-assets-rules',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
    })
    // The Admin SDK finds the emulator through FIRESTORE_EMULATOR_HOST.
    adminApp = initializeApp({ projectId: 'demo-kaydo-media-assets-rules' }, 'media-assets-rules')
    db = getFirestore(adminApp)
  })

  afterAll(async () => {
    await testEnv?.cleanup()
    if (adminApp) await deleteApp(adminApp)
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
    await db.doc(`families/${FAMILY}`).set({ adminUid: ADMIN, adminUids: [ADMIN] })
  })

  const sign = () =>
    signUpload({ db, apiKey: 'key', secret: 'secret', limits: LIMITS }, ADMIN, { familyId: FAMILY, kind: 'encrypted' })

  const assetIdOf = (publicId) => publicId.split('/').pop()

  it('records a pending entry for every signature', async () => {
    const { publicId } = await sign()
    const entry = (await db.collection(MEDIA_ASSETS).doc(assetIdOf(publicId)).get()).data()
    expect(entry).toMatchObject({ familyId: FAMILY, uid: ADMIN, publicId, state: 'pending', refs: [] })
  })

  it('is closed to the admin of the family the file belongs to', async () => {
    const { publicId } = await sign()
    const id = assetIdOf(publicId)
    const admin = testEnv
      .authenticatedContext(ADMIN, { familyId: FAMILY, role: 'admin', email_verified: true })
      .firestore()

    await assertFails(getDoc(doc(admin, MEDIA_ASSETS, id)))
    await assertFails(getDocs(collection(admin, MEDIA_ASSETS)))
    await assertFails(updateDoc(doc(admin, MEDIA_ASSETS, id), { state: 'attached' }))
    await assertFails(deleteDoc(doc(admin, MEDIA_ASSETS, id)))
    await assertFails(setDoc(doc(admin, MEDIA_ASSETS, 'forged'), { familyId: FAMILY, state: 'attached' }))
  })

  it('is closed to everyone else', async () => {
    const { publicId } = await sign()
    const stranger = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(stranger, MEDIA_ASSETS, assetIdOf(publicId))))
    await assertFails(setDoc(doc(stranger, MEDIA_ASSETS, 'forged'), { familyId: FAMILY }))
  })

  it('records nothing for a caller who is not an admin', async () => {
    await expect(
      signUpload({ db, apiKey: 'key', secret: 'secret', limits: LIMITS }, 'uid-other', { familyId: FAMILY }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
    expect((await db.collection(MEDIA_ASSETS).get()).size).toBe(0)
  })

  it('keeps the quota counters closed, so nobody lifts their own limit', async () => {
    const { publicId } = await sign()
    expect((await db.collection(MEDIA_USAGE).doc(FAMILY).get()).data()).toEqual({ bytes: 0, files: 0, unsized: 1 })
    // The daily lookup, with a real `bytes == null` query.
    const sizes = await syncMediaSizes({ db, lookup: async () => new Map([[publicId, 2048]]) })
    expect(sizes).toMatchObject({ unsized: 1, recorded: 1 })
    expect((await db.collection(MEDIA_USAGE).doc(FAMILY).get()).data()).toEqual({ bytes: 2048, files: 1, unsized: 0 })
    expect((await db.collection(MEDIA_RATES).doc(ADMIN).get()).data().count).toBe(1)

    const admin = testEnv
      .authenticatedContext(ADMIN, { familyId: FAMILY, role: 'admin', email_verified: true })
      .firestore()
    await assertFails(getDoc(doc(admin, MEDIA_USAGE, FAMILY)))
    await assertFails(setDoc(doc(admin, MEDIA_USAGE, FAMILY), { bytes: 0, files: 0 }))
    await assertFails(getDoc(doc(admin, MEDIA_RATES, ADMIN)))
    await assertFails(setDoc(doc(admin, MEDIA_RATES, ADMIN), { windowStart: 0, count: 0 }))
    await assertFails(deleteDoc(doc(admin, MEDIA_RATES, ADMIN)))
  })

  it('finds what is due with real queries, and deletes only that', async () => {
    const DAY = 24 * 60 * 60 * 1000
    const now = Date.now()
    const entry = (id, data) => db.collection(MEDIA_ASSETS).doc(id).set({
      familyId: FAMILY, publicId: `kaydo/${FAMILY}/${id}`, resourceType: 'raw', refs: [], ...data,
    })
    await entry('old-pending', { state: 'pending', createdAt: new Date(now - 8 * DAY) })
    await entry('new-pending', { state: 'pending', createdAt: new Date(now - 1 * DAY) })
    await entry('old-detached', { state: 'detached', createdAt: new Date(now - 90 * DAY), detachedAt: new Date(now - 31 * DAY), bytes: 10 })
    await entry('in-use', { state: 'attached', refs: ['memories/m1'], createdAt: new Date(now - 90 * DAY) })
    await db.collection(MEDIA_USAGE).doc(FAMILY).set({ bytes: 50, files: 3 })

    const destroyed = []
    const stats = await purgeMedia({
      db,
      dryRun: false,
      destroy: async (_type, ids) => { destroyed.push(...ids); return new Set(ids) },
    })

    expect(stats).toMatchObject({ due: 2, deleted: 2 })
    expect(destroyed.sort()).toEqual([`kaydo/${FAMILY}/old-detached`, `kaydo/${FAMILY}/old-pending`])
    const left = (await db.collection(MEDIA_ASSETS).get()).docs.map((d) => d.id).sort()
    expect(left).toEqual(['in-use', 'new-pending'])
    expect((await db.collection(MEDIA_USAGE).doc(FAMILY).get()).data()).toEqual({ bytes: 40, files: 2, unsized: 0 })
  })

  it('runs the legacy inventory with real queries, and keeps its report from clients', async () => {
    const list = async (type) => ({
      resources: type === 'raw' ? [{ public_id: 'kaydo/encrypted/lost.dat', bytes: 5 }] : [],
    })
    const report = await inventoryLegacyMedia({ db, list, now: () => Date.parse('2026-10-26T05:15:00Z') })
    expect(report).toMatchObject({ files: 1, unclaimed: 1, familiesNotIndexed: 1 })

    const admin = testEnv
      .authenticatedContext(ADMIN, { familyId: FAMILY, role: 'admin', email_verified: true })
      .firestore()
    await assertFails(getDoc(doc(admin, MEDIA_REPORTS, '2026-10-26')))
    await assertFails(setDoc(doc(admin, MEDIA_REPORTS, 'forged'), { unclaimed: 0 }))
  })
})
