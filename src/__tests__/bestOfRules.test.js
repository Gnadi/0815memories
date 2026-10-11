// @vitest-environment node
/**
 * The monthly best-of against the emulator: who may read and write the
 * `bestOf` collection, the month queries the app makes for it
 * (services/bestOf.js), and the count the push on the 1st is decided by
 * (countMonthMedia in functions/bestOf.js, through the Admin SDK as the
 * function runs it).
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDocs, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { bestOfListQuery, bestOfMonthQuery, monthEntriesQuery } from '../services/bestOf'
import { countMonthMedia, previousMonthWindow } from '../../functions/bestOf.js'

// Set by `firebase emulators:exec`; absent during a plain `npm test`.
const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

const FAMILY = 'family-1'
const OTHER_FAMILY = 'family-2'
const ADMIN = 'uid-admin'
const OTHER_ADMIN = 'uid-other'

// Stands in for encryptJSON(): base64, so it can never begin with '{' or '['.
const CIPHERTEXT = 'kJ8xQ2hZbGxvV29ybGRUaGlzSXNCYXNlNjQ='

let testEnv
let adminApp
let adminDb

const bestOf = (familyId, month, extra = {}) => ({
  familyId,
  month,
  version: 1,
  doc: CIPHERTEXT,
  createdByUid: ADMIN,
  createdAt: Timestamp.now(),
  ...extra,
})

// Midday, local time, as the app files a day.
const at = (y, m, d, h = 12) => Timestamp.fromDate(new Date(y, m - 1, d, h))

describe.skipIf(!EMULATOR)('best-of', () => {
  beforeAll(async () => {
    const [host, port] = EMULATOR.split(':')
    testEnv = await initializeTestEnvironment({
      // Its own project: clearFirestore() wipes the whole project, and vitest
      // runs the rules suites in parallel.
      projectId: 'demo-kaydo-bestof-rules',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
    })
    // The Admin SDK finds the emulator through FIRESTORE_EMULATOR_HOST.
    adminApp = initializeApp({ projectId: 'demo-kaydo-bestof-rules' }, 'best-of-rules')
    adminDb = getFirestore(adminApp)
  })

  afterAll(async () => {
    await testEnv?.cleanup()
    if (adminApp) await deleteApp(adminApp)
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'families', FAMILY), { adminUid: ADMIN, adminUids: [ADMIN] })
      await setDoc(doc(db, 'families', OTHER_FAMILY), { adminUid: OTHER_ADMIN, adminUids: [OTHER_ADMIN] })
      await setDoc(doc(db, 'bestOf', `${FAMILY}_2026-08`), bestOf(FAMILY, '2026-08'))
      await setDoc(doc(db, 'bestOf', `${OTHER_FAMILY}_2026-08`), bestOf(OTHER_FAMILY, '2026-08'))
    })
  })

  const asAdmin = (uid = ADMIN, familyId = FAMILY) =>
    testEnv.authenticatedContext(uid, { familyId, role: 'admin' }).firestore()
  const asViewer = (familyId = FAMILY) =>
    testEnv.authenticatedContext(`viewer:${familyId}`, { familyId, role: 'viewer' }).firestore()

  describe('reading', () => {
    it('shows the family its best-ofs, viewers included', async () => {
      const list = await assertSucceeds(getDocs(bestOfListQuery(asViewer(), FAMILY)))
      expect(list.docs.map((d) => d.id)).toEqual([`${FAMILY}_2026-08`])

      const month = await assertSucceeds(getDocs(bestOfMonthQuery(asViewer(), FAMILY, '2026-08')))
      expect(month.size).toBe(1)
    })

    it('answers a month nobody has made yet with nothing, not a denial', async () => {
      const month = await assertSucceeds(getDocs(bestOfMonthQuery(asViewer(), FAMILY, '2026-09')))
      expect(month.empty).toBe(true)
    })

    it("keeps another family's to that family", async () => {
      await assertFails(getDocs(bestOfListQuery(asViewer(OTHER_FAMILY), FAMILY)))
      await assertFails(getDocs(bestOfMonthQuery(asAdmin(OTHER_ADMIN, OTHER_FAMILY), FAMILY, '2026-08')))
      await assertFails(getDocs(bestOfListQuery(testEnv.unauthenticatedContext().firestore(), FAMILY)))
    })
  })

  describe('writing', () => {
    const put = (db, id, data) => setDoc(doc(db, 'bestOf', id), data)

    it('lets an admin save a month under the one id it can have', async () => {
      await assertSucceeds(put(asAdmin(), `${FAMILY}_2026-09`, bestOf(FAMILY, '2026-09')))
      // Made again replaces it.
      await assertSucceeds(put(asAdmin(), `${FAMILY}_2026-09`, bestOf(FAMILY, '2026-09', { version: 2 })))
    })

    it('refuses any other id, so no month has two and no family files under another', async () => {
      await assertFails(put(asAdmin(), 'random-id', bestOf(FAMILY, '2026-09')))
      await assertFails(put(asAdmin(), `${FAMILY}_2026-10`, bestOf(FAMILY, '2026-09')))
      await assertFails(put(asAdmin(), `${OTHER_FAMILY}_2026-09`, bestOf(FAMILY, '2026-09')))
      await assertFails(put(asAdmin(), `${FAMILY}_2026-13`, bestOf(FAMILY, '2026-13')))
    })

    it('refuses the story in plaintext, or anything beside it', async () => {
      await assertFails(put(asAdmin(), `${FAMILY}_2026-09`, bestOf(FAMILY, '2026-09', { doc: '{"slides":[]}' })))
      await assertFails(put(asAdmin(), `${FAMILY}_2026-09`, bestOf(FAMILY, '2026-09', { doc: { slides: [] } })))
      await assertFails(put(asAdmin(), `${FAMILY}_2026-09`, bestOf(FAMILY, '2026-09', { title: 'Best of September' })))
    })

    it('leaves viewers and other families out', async () => {
      await assertFails(put(asViewer(), `${FAMILY}_2026-09`, bestOf(FAMILY, '2026-09')))
      await assertFails(put(asAdmin(OTHER_ADMIN, OTHER_FAMILY), `${FAMILY}_2026-09`, bestOf(FAMILY, '2026-09')))
      await assertFails(updateDoc(doc(asAdmin(OTHER_ADMIN, OTHER_FAMILY), 'bestOf', `${FAMILY}_2026-08`), { version: 3 }))
      await assertFails(deleteDoc(doc(asViewer(), 'bestOf', `${FAMILY}_2026-08`)))
      await assertFails(deleteDoc(doc(asAdmin(OTHER_ADMIN, OTHER_FAMILY), 'bestOf', `${FAMILY}_2026-08`)))
    })

    it('lets an admin delete their own', async () => {
      await assertSucceeds(deleteDoc(doc(asAdmin(), 'bestOf', `${FAMILY}_2026-08`)))
    })
  })

  describe('the month it is made of', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore()
        const put = (col, id, familyId, date, extra = {}) =>
          setDoc(doc(db, col, id), { familyId, date, images: ['x.enc'], ...extra })
        await put('memories', 'sep-memory', FAMILY, at(2026, 9, 3), { images: ['a', 'b', 'c'], videos: [{ url: 'v' }] })
        await put('memories', 'aug-memory', FAMILY, at(2026, 8, 31, 23))
        await put('moments', 'sep-moment', FAMILY, at(2026, 9, 30, 22), { images: ['d', 'e'] })
        await put('moments', 'oct-moment', FAMILY, at(2026, 10, 1, 0))
        await put('moments', 'other-sep', OTHER_FAMILY, at(2026, 9, 10), { images: ['o'] })
      })
    })

    it("lets a viewer read the family's month, and only that month", async () => {
      const memories = await assertSucceeds(getDocs(monthEntriesQuery(asViewer(), 'memories', FAMILY, '2026-09')))
      const moments = await assertSucceeds(getDocs(monthEntriesQuery(asViewer(), 'moments', FAMILY, '2026-09')))
      expect(memories.docs.map((d) => d.id)).toEqual(['sep-memory'])
      expect(moments.docs.map((d) => d.id)).toEqual(['sep-moment'])
    })

    it("refuses another family's month", async () => {
      await assertFails(getDocs(monthEntriesQuery(asViewer(OTHER_FAMILY), 'moments', FAMILY, '2026-09')))
    })

    it('counts the month for the push, per family, by the family’s calendar', async () => {
      // Instants, not local dates: the job runs in UTC and counts Berlin's
      // month. September in Berlin is 31 August 22:00 to 30 September 22:00 UTC.
      const put = (id, iso, images) =>
        adminDb.doc(`moments/${id}`).set({ familyId: 'family-3', date: new Date(iso), images })
      await put('first-moment', '2026-08-31T22:00:00Z', ['a', 'b'])
      await put('last-moment', '2026-09-30T21:59:59Z', ['c'])
      await put('mid-month', '2026-09-15T12:00:00Z', ['d', 'e', 'f'])
      await put('day-before', '2026-08-31T21:59:59Z', ['x'])
      await put('day-after', '2026-09-30T22:00:00Z', ['y'])
      await put('no-media', '2026-09-15T12:00:00Z', [])

      const window = previousMonthWindow(new Date('2026-10-01T16:00:00Z'), 'Europe/Berlin')
      const counts = await countMonthMedia(adminDb, window)
      expect(counts.get('family-3')).toBe(6)
    })
  })
})
