// @vitest-environment node
/**
 * Viewer login throttling — functions/viewerLogin.js against the emulator.
 *
 * The throttle used to block a whole family, right password included, and
 * family ids are public: a few wrong guesses every quarter of an hour kept a
 * family's viewers out. A device that has signed in before now carries a device
 * token that takes it out of the family-wide block; only devices that never
 * signed in — which is what a guesser is — still share the family's limit.
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { checkViewerLogin, DEVICES, MAX_FAILURES } from '../../functions/viewerLogin.js'

// Set by `firebase emulators:exec`; absent during a plain `npm test`.
const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

const FAMILY = 'family-1'
const OTHER_FAMILY = 'family-2'
const RIGHT = 'correct horse'

let testEnv
let adminApp
let db
let deps

const login = (input) => checkViewerLogin(deps, { familyId: FAMILY, ip: '203.0.113.7', ...input })

/** A stranger's guesses, each from a different claimed IP — X-Forwarded-For is theirs to set. */
async function lockOutFamily(familyId = FAMILY) {
  for (let i = 0; i < MAX_FAILURES; i++) {
    await login({ familyId, password: `guess-${i}`, ip: `198.51.100.${i}` })
  }
  expect(await login({ familyId, password: RIGHT, ip: '192.0.2.1' })).toEqual({ outcome: 'blocked' })
}

describe.skipIf(!EMULATOR)('viewer login', () => {
  beforeAll(async () => {
    const [host, port] = EMULATOR.split(':')
    testEnv = await initializeTestEnvironment({
      // Its own project: clearFirestore() wipes the whole project, and vitest
      // runs the rules suites in parallel.
      projectId: 'demo-kaydo-viewer-login-rules',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
    })
    // The Admin SDK finds the emulator through FIRESTORE_EMULATOR_HOST.
    adminApp = initializeApp({ projectId: 'demo-kaydo-viewer-login-rules' }, 'viewer-login-rules')
    db = getFirestore(adminApp)
  })

  afterAll(async () => {
    await testEnv?.cleanup()
    if (adminApp) await deleteApp(adminApp)
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
    // Stands in for bcrypt: the hash is the password, reversed.
    deps = {
      db,
      compare: vi.fn(async (password, hash) => [...password].reverse().join('') === hash),
      mintToken: vi.fn(async (familyId) => `custom-token-for-${familyId}`),
    }
    for (const familyId of [FAMILY, OTHER_FAMILY]) {
      await db.doc(`families/${familyId}/secrets/auth`).set({
        sharedPassword: [...RIGHT].reverse().join(''),
      })
    }
  })

  it('signs in with the right password and hands the device a token', async () => {
    const result = await login({ password: RIGHT })
    expect(result).toMatchObject({ outcome: 'ok', token: `custom-token-for-${FAMILY}` })
    expect(result.deviceToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('stores only a hash of the device token', async () => {
    const { deviceToken } = await login({ password: RIGHT })
    const stored = await db.collection(DEVICES).get()
    expect(stored.size).toBe(1)
    expect(stored.docs[0].id).not.toBe(deviceToken)
    expect(JSON.stringify(stored.docs[0].data())).not.toContain(deviceToken)
  })

  it('mints no new token for a device that already has one', async () => {
    const { deviceToken } = await login({ password: RIGHT })
    const again = await login({ password: RIGHT, deviceToken })
    expect(again).toEqual({ outcome: 'ok', token: `custom-token-for-${FAMILY}` })
    expect((await db.collection(DEVICES).get()).size).toBe(1)
  })

  it('refuses a wrong password, and mints nothing', async () => {
    expect(await login({ password: 'wrong' })).toEqual({ outcome: 'denied' })
    expect(deps.mintToken).not.toHaveBeenCalled()
    expect((await db.collection(DEVICES).get()).size).toBe(0)
  })

  it('still locks a family against devices that never signed in', async () => {
    // The guessing limit that matters: however many IPs the guesses claim to
    // come from, a new device gets MAX_FAILURES tries per family.
    await lockOutFamily()
    expect(deps.compare).toHaveBeenCalledTimes(MAX_FAILURES)
  })

  it('does not lock out a device that has signed in before', async () => {
    // The finding: a stranger's wrong guesses used to keep every viewer out.
    const { deviceToken } = await login({ password: RIGHT })
    await lockOutFamily()
    expect(await login({ password: RIGHT, deviceToken })).toMatchObject({ outcome: 'ok' })
  })

  it('throttles a known device on its own failures', async () => {
    const { deviceToken } = await login({ password: RIGHT })
    const { deviceToken: otherDevice } = await login({ password: RIGHT })
    for (let i = 0; i < MAX_FAILURES; i++) await login({ password: `guess-${i}`, deviceToken })

    expect(await login({ password: RIGHT, deviceToken })).toEqual({ outcome: 'blocked' })
    // …which is nobody else's problem.
    expect(await login({ password: RIGHT, deviceToken: otherDevice })).toMatchObject({ outcome: 'ok' })
    expect(await login({ password: RIGHT, ip: '192.0.2.99' })).toMatchObject({ outcome: 'ok' })
  })

  it('does not let a token from one family exempt a device in another', async () => {
    const { deviceToken } = await login({ password: RIGHT })
    await lockOutFamily(OTHER_FAMILY)
    expect(await login({ familyId: OTHER_FAMILY, password: RIGHT, deviceToken })).toEqual({
      outcome: 'blocked',
    })
  })

  it('treats a made-up device token as no token', async () => {
    await lockOutFamily()
    const forged = 'A'.repeat(43)
    expect(await login({ password: RIGHT, deviceToken: forged })).toEqual({ outcome: 'blocked' })
  })

  it('refuses a family id that is not one, without doing any work', async () => {
    for (const familyId of ['a/b', '', 'x'.repeat(101), '../secrets']) {
      expect(await login({ familyId, password: RIGHT })).toEqual({ outcome: 'denied' })
    }
    expect(deps.compare).not.toHaveBeenCalled()
  })

  it('keeps the device registry out of reach of clients', async () => {
    const { deviceToken } = await login({ password: RIGHT })
    const [stored] = (await db.collection(DEVICES).get()).docs
    const client = testEnv.authenticatedContext(`viewer:${FAMILY}`, { familyId: FAMILY, role: 'viewer' }).firestore()
    await assertFails(getDoc(doc(client, DEVICES, stored.id)))
    await assertFails(setDoc(doc(client, DEVICES, 'forged'), { familyId: FAMILY }))
    expect(deviceToken).toBeTruthy()
  })
})
