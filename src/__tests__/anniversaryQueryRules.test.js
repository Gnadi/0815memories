// @vitest-environment node
/**
 * The anniversary job's query — countAnniversaryMemories in
 * functions/anniversary.js — against the emulator, through the Admin SDK as
 * the function runs it.
 *
 * It used to be one query per family, one after another, and every family
 * cost a billed read a day even with nothing to find. It is now one range on
 * `date` over all memories, grouped by family.
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { anniversaryWindow, countAnniversaryMemories } from '../../functions/anniversary.js'

// Set by `firebase emulators:exec`; absent during a plain `npm test`.
const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

let testEnv
let adminApp
let db

describe.skipIf(!EMULATOR)('anniversary query', () => {
  beforeAll(async () => {
    const [host, port] = EMULATOR.split(':')
    testEnv = await initializeTestEnvironment({
      // Its own project: clearFirestore() wipes the whole project, and vitest
      // runs the rules suites in parallel.
      projectId: 'demo-kaydo-anniversary-rules',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
    })
    // The Admin SDK finds the emulator through FIRESTORE_EMULATOR_HOST.
    adminApp = initializeApp({ projectId: 'demo-kaydo-anniversary-rules' }, 'anniversary-rules')
    db = getFirestore(adminApp)
  })

  afterAll(async () => {
    await testEnv?.cleanup()
    if (adminApp) await deleteApp(adminApp)
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
  })

  // 16 April 2026, 08:00 in Berlin — when the job runs. Three years back is
  // 16 April 2023, 00:00–23:59:59.999 Berlin time (UTC+2 in April).
  const window = anniversaryWindow(new Date('2026-04-16T06:00:00Z'), 'Europe/Berlin')
  const put = (id, familyId, iso) => db.doc(`memories/${id}`).set({ familyId, date: new Date(iso), title: 'ciphertext' })

  it('counts each family’s memories on the day, and only that day', async () => {
    await put('a1', 'fam-a', '2023-04-15T22:00:00Z') // 00:00 Berlin — first moment of the day
    await put('a2', 'fam-a', '2023-04-16T12:00:00Z')
    await put('a3', 'fam-a', '2023-04-16T21:59:59Z') // 23:59:59 Berlin
    await put('a-before', 'fam-a', '2023-04-15T21:59:59Z') // 23:59:59 Berlin, the day before
    await put('a-after', 'fam-a', '2023-04-16T22:00:00Z') // 00:00 Berlin, the day after
    await put('a-other-year', 'fam-a', '2024-04-16T12:00:00Z')
    await put('b1', 'fam-b', '2023-04-16T09:00:00Z')

    const counts = await countAnniversaryMemories(db, window)
    expect(Object.fromEntries(counts)).toEqual({ 'fam-a': 3, 'fam-b': 1 })
  })

  it('leaves out families with nothing that day, rather than counting them as zero', async () => {
    await put('c1', 'fam-c', '2022-04-16T12:00:00Z')
    expect((await countAnniversaryMemories(db, window)).size).toBe(0)
  })
})
