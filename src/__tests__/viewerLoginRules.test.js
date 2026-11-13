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
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import {
  checkViewerLogin,
  DEVICES,
  MAX_FAILURES,
  MAX_BLOCK_MS,
  FAILURE_WINDOW_MS,
  RATE_LIMIT_TTL_MS,
  DEVICE_TTL_MS,
  forgetViewerDevices,
  replaceSharedPassword,
} from '../../functions/viewerLogin.js'

// Set by `firebase emulators:exec`; absent during a plain `npm test`.
const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

const FAMILY = 'family-1'
const OTHER_FAMILY = 'family-2'
const RIGHT = 'correct horse'
const NEW_PASSWORD = 'battery staple'
const reversed = (password) => [...password].reverse().join('')

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
      await db.doc(`families/${familyId}`).set({ adminUid: 'owner', adminUids: ['owner'], viewerSessionVersion: 0 })
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

  it('lets only MAX_FAILURES concurrent guesses from a new device reach the comparison', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => login({ password: `guess-${i}`, ip: '198.51.100.1' })),
    )
    expect(deps.compare).toHaveBeenCalledTimes(MAX_FAILURES)
    expect(results.filter((r) => r.outcome === 'denied')).toHaveLength(MAX_FAILURES)
    expect(results.filter((r) => r.outcome === 'blocked')).toHaveLength(20 - MAX_FAILURES)
  }, 30_000)

  it('keeps escalating the block across the failure window', async () => {
    let t = Date.parse('2030-01-01T00:00:00Z')
    deps.now = () => t
    const blockLengths = []
    for (let i = 0; i < 20 && !blockLengths.includes(MAX_BLOCK_MS); i++) {
      // Waiting out the block exactly is the fastest a guesser can go.
      expect(await login({ password: `guess-${i}`, ip: '198.51.100.1' })).toEqual({ outcome: 'denied' })
      const record = await db.doc(`rateLimits/${(await db.collection('rateLimits').get()).docs[0].id}`).get()
      const until = record.data().blockedUntil
      if (until) {
        blockLengths.push(until.toMillis() - t)
        t = until.toMillis()
      }
    }
    // Block lengths double with every further failure, past the old 15 minute
    // window, until they reach the cap.
    expect(blockLengths.length).toBeGreaterThan(2)
    for (let i = 1; i < blockLengths.length; i++) {
      expect(blockLengths[i]).toBeGreaterThan(blockLengths[i - 1])
    }
    expect(blockLengths.at(-1)).toBe(MAX_BLOCK_MS)
    expect(blockLengths.reduce((a, b) => a + b, 0)).toBeGreaterThan(FAILURE_WINDOW_MS)
  })

  it('starts counting again after a quiet period', async () => {
    let t = Date.parse('2030-01-01T00:00:00Z')
    deps.now = () => t
    for (let i = 0; i < MAX_FAILURES - 1; i++) await login({ password: `guess-${i}` })
    t += FAILURE_WINDOW_MS
    for (let i = 0; i < MAX_FAILURES - 1; i++) {
      expect(await login({ password: `again-${i}` })).toEqual({ outcome: 'denied' })
    }
  })

  it('accepts the right password after failures, and clears the record', async () => {
    for (let i = 0; i < MAX_FAILURES - 1; i++) await login({ password: `guess-${i}` })
    expect(await login({ password: RIGHT })).toMatchObject({ outcome: 'ok' })
    expect((await db.collection('rateLimits').get()).size).toBe(0)
    // A full allowance is available again.
    for (let i = 0; i < MAX_FAILURES; i++) {
      expect(await login({ password: `guess-${i}` })).toEqual({ outcome: 'denied' })
    }
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

  // A password change as setSharedPassword makes it.
  const changePassword = (password, familyId = FAMILY) =>
    replaceSharedPassword({ db, increment: (n) => FieldValue.increment(n) }, familyId, reversed(password))

  it('refuses a login whose password changed while it was being compared', async () => {
    // The race: the old hash is read, then bcrypt runs, and the admin's change
    // lands before the token is minted. The token must not get the new version.
    deps.compare = vi.fn(async (password, hash) => {
      await changePassword(NEW_PASSWORD)
      return reversed(password) === hash
    })
    expect(await login({ password: RIGHT })).toEqual({ outcome: 'denied' })
    expect(deps.mintToken).not.toHaveBeenCalled()
    expect((await db.collection(DEVICES).get()).size).toBe(0)
  })

  it('mints the token with the version that was current at the comparison', async () => {
    await db.doc(`families/${FAMILY}`).update({ viewerSessionVersion: 3 })
    const { deviceToken } = await login({ password: RIGHT })
    expect(deps.mintToken).toHaveBeenCalledWith(FAMILY, 3)
    await login({ password: RIGHT, deviceToken })
    expect(deps.mintToken).toHaveBeenLastCalledWith(FAMILY, 3)
  })

  it('writes the hash and the version bump together', async () => {
    await changePassword(NEW_PASSWORD)
    expect((await db.doc(`families/${FAMILY}/secrets/auth`).get()).data().sharedPassword).toBe(reversed(NEW_PASSWORD))
    expect((await db.doc(`families/${FAMILY}`).get()).data().viewerSessionVersion).toBe(1)
    // The old password is out, the new one in, and the token carries version 1.
    expect(await login({ password: RIGHT })).toEqual({ outcome: 'denied' })
    expect(await login({ password: NEW_PASSWORD })).toMatchObject({ outcome: 'ok' })
    expect(deps.mintToken).toHaveBeenCalledWith(FAMILY, 1)
  })

  it('forgets the devices of a family, and only of that family', async () => {
    for (let i = 0; i < 3; i++) await login({ password: RIGHT })
    await login({ familyId: OTHER_FAMILY, password: RIGHT })
    // More than one page of them.
    for (let start = 0; start < 450; start += 225) {
      const batch = db.batch()
      for (let i = start; i < start + 225; i++) batch.set(db.collection(DEVICES).doc(`bulk-${i}`), { familyId: FAMILY })
      await batch.commit()
    }
    expect(await forgetViewerDevices(db, FAMILY)).toBe(453)
    const left = await db.collection(DEVICES).get()
    expect(left.docs.map((d) => d.data().familyId)).toEqual([OTHER_FAMILY])
  }, 30_000)

  it('gives a device no exemption once the password has changed, even if it was not deleted', async () => {
    const { deviceToken } = await login({ password: RIGHT })
    await changePassword(NEW_PASSWORD)
    deps.compare.mockClear()
    // Deleting the device is skipped on purpose: the version has to be enough.
    await lockOutFamily()
    expect(await login({ password: NEW_PASSWORD, deviceToken })).toEqual({ outcome: 'blocked' })
    expect(deps.compare).toHaveBeenCalledTimes(MAX_FAILURES)
  })

  it('stamps a device with the family version, and reads one without as version 0', async () => {
    await db.doc(`families/${FAMILY}`).update({ viewerSessionVersion: 2 })
    const { deviceToken } = await login({ password: RIGHT })
    const [stored] = (await db.collection(DEVICES).get()).docs
    expect(stored.data().sv).toBe(2)
    expect(await login({ password: RIGHT, deviceToken })).toMatchObject({ outcome: 'ok' })

    // A device from before the field: known while the family is at version 0 only.
    await stored.ref.update({ sv: FieldValue.delete() })
    await lockOutFamily()
    expect(await login({ password: RIGHT, deviceToken })).toEqual({ outcome: 'blocked' })
    await db.doc(`families/${FAMILY}`).update({ viewerSessionVersion: 0 })
    expect(await login({ password: RIGHT, deviceToken })).toMatchObject({ outcome: 'ok' })
  })

  it('sets an expiry on counters and devices, and renews the device\'s when it is used', async () => {
    let t = Date.parse('2030-01-01T00:00:00Z')
    deps.now = () => t
    await login({ password: 'wrong' })
    const [counter] = (await db.collection('rateLimits').get()).docs
    expect(counter.data().expireAt.toMillis()).toBe(t + RATE_LIMIT_TTL_MS)

    const { deviceToken } = await login({ password: RIGHT })
    const [device] = (await db.collection(DEVICES).get()).docs
    expect(device.data().expireAt.toMillis()).toBe(t + DEVICE_TTL_MS)

    t += 30 * 24 * 60 * 60 * 1000
    await login({ password: RIGHT, deviceToken })
    expect((await device.ref.get()).data().expireAt.toMillis()).toBe(t + DEVICE_TTL_MS)
  })

  it('reports each login with its outcome and kind of device, and nothing secret', async () => {
    const log = vi.fn()
    deps.log = log
    const { deviceToken } = await login({ password: RIGHT })
    await login({ password: RIGHT, deviceToken })
    await login({ password: 'wrong', ip: '198.51.100.77' })
    await lockOutFamily()
    expect(log.mock.calls.map(([event]) => `${event.outcome}/${event.device}`).slice(0, 3)).toEqual([
      'ok/new',
      'ok/known',
      'denied/new',
    ])
    expect(log.mock.calls.at(-1)[0]).toEqual({ familyId: FAMILY, outcome: 'blocked', device: 'new' })
    const everything = JSON.stringify(log.mock.calls)
    for (const secret of [RIGHT, 'wrong', deviceToken, '198.51.100.77']) expect(everything).not.toContain(secret)
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
