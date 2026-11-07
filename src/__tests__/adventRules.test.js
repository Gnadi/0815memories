/**
 * The advent calendar's queries — services/advent.js — against the emulator,
 * run as a viewer so the rules apply exactly as they do in the app.
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDocs, setDoc, Timestamp } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { adventRangeQuery, entriesBeforeQuery, fetchAdventEntries } from '../services/advent'
import { doorOpensAt } from '../utils/advent'

// Set by `firebase emulators:exec`; absent during a plain `npm test`.
const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

const FAMILY = 'family-1'
const OTHER_FAMILY = 'family-2'

let testEnv

const at = (y, m, d) => Timestamp.fromDate(new Date(y, m - 1, d, 12))
const ids = (list) => list.map((m) => m.id).sort()

describe.skipIf(!EMULATOR)('advent calendar queries', () => {
  beforeAll(async () => {
    const [host, port] = EMULATOR.split(':')
    testEnv = await initializeTestEnvironment({
      // Its own project: clearFirestore() wipes the whole project, and vitest
      // runs the rules suites in parallel.
      projectId: 'demo-kaydo-advent-rules',
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
      const put = (collectionName, id, familyId, date) =>
        setDoc(doc(db, collectionName, id), { familyId, date, title: id })
      await put('memories', 'nov-2026', FAMILY, at(2026, 11, 20))
      await put('memories', 'dec-2026', FAMILY, at(2026, 12, 2)) // during the calendar: not in it
      await put('memories', 'dec6-2023', FAMILY, at(2023, 12, 6))
      await put('memories', 'dec26-2023', FAMILY, at(2023, 12, 26)) // after the last door
      await put('moments', 'moment-2025', FAMILY, at(2025, 12, 24))
      await put('memories', 'other', OTHER_FAMILY, at(2025, 12, 6))
    })
  })

  const asViewer = (familyId = FAMILY) =>
    testEnv.authenticatedContext(`viewer:${familyId}`, { familyId, role: 'viewer' }).firestore()

  it('reads the entries from before the first door, newest first', async () => {
    const snap = await getDocs(entriesBeforeQuery(asViewer(), 'memories', FAMILY, doorOpensAt(2026, 1)))
    expect(snap.docs.map((d) => d.id)).toEqual(['nov-2026', 'dec26-2023', 'dec6-2023'])
  })

  it('reads one past Advent, 1 to 24 December, and nothing else', async () => {
    const snap = await getDocs(adventRangeQuery(asViewer(), 'memories', FAMILY, 2023))
    expect(snap.docs.map((d) => d.id)).toEqual(['dec6-2023'])
  })

  it('gathers memories and moments of the family, each once', async () => {
    const { memories, moments } = await fetchAdventEntries(asViewer(), FAMILY, 2026)
    expect(ids(memories)).toEqual(['dec26-2023', 'dec6-2023', 'nov-2026'])
    expect(ids(moments)).toEqual(['moment-2025'])
  })

  it('stays inside the rules: another family cannot run them', async () => {
    await assertFails(fetchAdventEntries(asViewer(OTHER_FAMILY), FAMILY, 2026))
  })
})
