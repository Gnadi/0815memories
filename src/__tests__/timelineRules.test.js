/**
 * The Smart Timeline's queries — hooks/useTimeline.js — against the emulator,
 * run as a viewer so the rules apply exactly as they do in the app.
 *
 * The timeline used to filter the home feed's newest 50 memories in the
 * browser. A family with more than 50 lost every older year: no chip, no view,
 * and "On this day" searched only those 50. The fixture below has 60 in one
 * year and the interesting ones behind them.
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDocs, setDoc, Timestamp } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { fetchTimelineYears, fetchOnThisDay, yearQuery } from '../hooks/useTimeline'

// Set by `firebase emulators:exec`; absent during a plain `npm test`.
const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

const FAMILY = 'family-1'
const OTHER_FAMILY = 'family-2'

let testEnv

// Midday, local time: the queries group by the local calendar, as the page does.
const at = (y, m, d) => Timestamp.fromDate(new Date(y, m - 1, d, 12))
const ids = (list) => list.map((m) => m.id)

describe.skipIf(!EMULATOR)('Smart Timeline queries', () => {
  beforeAll(async () => {
    const [host, port] = EMULATOR.split(':')
    testEnv = await initializeTestEnvironment({
      // Its own project: clearFirestore() wipes the whole project, and vitest
      // runs the rules suites in parallel.
      projectId: 'demo-kaydo-timeline-rules',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
    })
  })

  afterAll(async () => {
    await testEnv?.cleanup()
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'families', FAMILY), { adminUid: 'uid-admin', adminUids: ['uid-admin'] })
      await setDoc(doc(db, 'families', OTHER_FAMILY), { adminUid: 'uid-other', adminUids: ['uid-other'] })

      const put = (id, familyId, date) => setDoc(doc(db, 'memories', id), { familyId, date, title: id })
      // More than the feed's 50, all newer than everything else, and none on
      // the 15th–17th, so they stay out of the "On this day" cases.
      await Promise.all(
        Array.from({ length: 60 }, (_, i) => put(`recent-${i}`, FAMILY, at(2025, 1 + (i % 12), 1 + (i % 14)))),
      )
      await put('apr16-2023', FAMILY, at(2023, 4, 16))
      await put('apr16-2021', FAMILY, at(2021, 4, 16))
      await put('jul01-2021', FAMILY, at(2021, 7, 1))
      await put('dec25-2019', FAMILY, at(2019, 12, 25))
      await put('feb29-2016', FAMILY, at(2016, 2, 29))
      await put('apr15-2015', FAMILY, at(2015, 4, 15))
      await put('apr17-2015', FAMILY, at(2015, 4, 17))
      // Someone else's family, on the same day and in a year of its own.
      await put('other-apr16', OTHER_FAMILY, at(2020, 4, 16))
      await put('other-2017', OTHER_FAMILY, at(2017, 6, 1))
    })
  })

  const asViewer = (familyId = FAMILY) =>
    testEnv.authenticatedContext(`viewer:${familyId}`, { familyId, role: 'viewer' }).firestore()

  it('lists every year with a memory, however far behind the newest 50', async () => {
    expect(await fetchTimelineYears(asViewer(), FAMILY)).toEqual([2025, 2023, 2021, 2019, 2016, 2015])
  })

  it('returns a whole year, not just its first 50', async () => {
    const snap = await getDocs(yearQuery(asViewer(), FAMILY, 2025))
    expect(snap.size).toBe(60)
  })

  it('returns an old year in full, newest first, and nothing else', async () => {
    const snap = await getDocs(yearQuery(asViewer(), FAMILY, 2021))
    expect(snap.docs.map((d) => d.id)).toEqual(['jul01-2021', 'apr16-2021'])
  })

  it('finds "On this day" across every year, and only that day', async () => {
    const db = asViewer()
    const years = await fetchTimelineYears(db, FAMILY)
    const found = await fetchOnThisDay(db, FAMILY, years, new Date(2026, 3, 16, 9))
    // Not the 15th or 17th, and not the other family's 16 April.
    expect(ids(found)).toEqual(['apr16-2023', 'apr16-2021'])
  })

  it('finds 29 February only in leap years, rather than on 1 March', async () => {
    const db = asViewer()
    const years = await fetchTimelineYears(db, FAMILY)
    const found = await fetchOnThisDay(db, FAMILY, years, new Date(2028, 1, 29, 9))
    expect(ids(found)).toEqual(['feb29-2016'])
  })

  it('stays inside the rules: another family cannot run them', async () => {
    await assertFails(fetchTimelineYears(asViewer(OTHER_FAMILY), FAMILY))
  })
})
