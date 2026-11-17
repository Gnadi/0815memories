/**
 * Viewer login: check a family's shared password, and throttle the guessing.
 *
 * The throttle used to key on the family alone, and a blocked family refused
 * everyone — the right password included. Family ids are public, so anyone
 * could keep a family's viewers locked out with a few wrong guesses every
 * quarter of an hour. There is no key on the caller's address: Cloud Functions
 * trusts X-Forwarded-For, so `req.ip` is whatever the caller says. It limited
 * nothing, and it meant storing an address for no gain, so none is kept.
 *
 * So a device that has signed in before now carries a device token, minted on
 * its first successful login. With it, the family-wide block does not apply:
 * the device is throttled on its own failures instead. Only devices that have
 * never signed in — which is who a password guesser is — still share the
 * family's limit, and still hit it.
 *
 * The failure counter alone is not enough. It forgets after a quiet quarter of
 * an hour, which allowed some 460 guesses a day per family, and it is cleared
 * by a success, so a caller with the right password could run bcrypt and mint
 * devices without end. Each key therefore also has a daily budget of attempts
 * of any outcome (MAX_ATTEMPTS_PER_DAY in a rolling day) that nothing clears.
 *
 * A device token grants nothing by itself. It exempts from the family's
 * lockout, not from the password. Only its hash is stored. It belongs to one
 * password too: it records the family's session version, and changing the
 * password deletes the family's devices, so a token an ex-viewer kept buys no
 * extra guesses against the new one.
 *
 * Nothing here imports firebase-admin or firebase-functions; the Firestore
 * instance and the side effects come in as arguments, so the test suite can
 * run this against the emulator.
 */
import { createHash, randomBytes } from 'node:crypto'

export const MAX_FAILURES = 5
export const FAILURE_WINDOW_MS = 15 * 60 * 1000
export const BASE_BLOCK_MS = 30 * 1000
export const MAX_BLOCK_MS = 60 * 60 * 1000
// Attempts of any outcome per throttle key in a rolling 24 hours. A household
// signs in a handful of times a day, so this is far above real use and still
// caps a guesser at a few hundred guesses a year per family.
export const MAX_ATTEMPTS_PER_DAY = 100
export const ATTEMPT_BUDGET_WINDOW_MS = 24 * 60 * 60 * 1000
// `expireAt` is for Firestore's TTL policies, which the operator sets up on
// `rateLimits` and `viewerDevices` (the field is inert until they do). Counters
// of ids nobody uses would otherwise pile up for good, and so would the devices
// of people who stopped visiting.
export const RATE_LIMIT_TTL_MS = 24 * 60 * 60 * 1000
export const DEVICE_TTL_MS = 180 * 24 * 60 * 60 * 1000

// A page of devices to delete at once; a batch holds at most 500 writes.
const DEVICE_PAGE = 400

/** Hashes of device tokens, each bound to one family. Admin SDK only. */
export const DEVICES = 'viewerDevices'

// Firestore auto-ids, with room for the hand-picked ids of seed data. A slash
// would address another document, and the viewer uid built from it has to stay
// within Firebase Auth's 128 characters.
const FAMILY_ID = /^[A-Za-z0-9_-]{1,100}$/
// 32 random bytes, base64url without padding.
const DEVICE_TOKEN = /^[A-Za-z0-9_-]{43}$/

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

/** Rate-limit keys must be a single path segment, so the id is sanitised. */
export const safeKey = (prefix, value) =>
  `${prefix}__${String(value).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 96)}`

/**
 * Counts an attempt against every key, or refuses it when one of them is
 * blocked or out of budget. The attempts are counted before the password is
 * compared, in one transaction, so that concurrent requests are serialised on
 * the counters and cannot all pass the check before any of them is recorded.
 * A successful login clears the failure counters again, but never the budgets.
 *
 * The failure counter starts over only after a quiet period:
 * FAILURE_WINDOW_MS since the last attempt, or since the end of the last block
 * if that came later. It never starts over while a block is active, so the
 * blocks keep growing for as long as someone keeps guessing.
 *
 * The budget keeps the times of the attempts of the last day, so the day rolls
 * rather than resets at a fixed hour. An attempt refused for lack of budget is
 * not recorded: the budget frees up as old attempts age out, and a flood of
 * refused calls cannot keep it exhausted beyond that.
 *
 * @param {any} db
 * @param {string[]} keys  failure counters
 * @param {string[]} budgetKeys  attempt budgets, one per counter
 * @returns {Promise<boolean>} whether the attempt may go on to the comparison
 */
async function reserveAttempt(db, keys, budgetKeys, now) {
  const refs = keys.map((key) => db.doc(`rateLimits/${key}`))
  const budgetRefs = budgetKeys.map((key) => db.doc(`rateLimits/${key}`))
  return db.runTransaction(async (tx) => {
    // All reads come before the first write.
    const [snaps, budgetSnaps] = await Promise.all([
      Promise.all(refs.map((ref) => tx.get(ref))),
      Promise.all(budgetRefs.map((ref) => tx.get(ref))),
    ])
    const records = snaps.map((snap) => (snap.exists ? snap.data() : null))
    const recent = budgetSnaps.map((snap) =>
      (snap.exists && Array.isArray(snap.data().attempts) ? snap.data().attempts : []).filter(
        (at) => typeof at === 'number' && now - at < ATTEMPT_BUDGET_WINDOW_MS,
      ),
    )

    if (records.some((data) => (data?.blockedUntil?.toMillis?.() ?? 0) > now)) return false
    if (recent.some((attempts) => attempts.length >= MAX_ATTEMPTS_PER_DAY)) return false

    budgetRefs.forEach((ref, i) => {
      tx.set(ref, {
        attempts: [...recent[i], now],
        updatedAt: new Date(now),
        expireAt: new Date(now + RATE_LIMIT_TTL_MS),
      })
    })

    refs.forEach((ref, i) => {
      const data = records[i]
      const lastActivity = Math.max(
        data?.updatedAt?.toMillis?.() ?? 0,
        data?.blockedUntil?.toMillis?.() ?? 0,
      )
      const quiet = !data || now - lastActivity >= FAILURE_WINDOW_MS

      const failures = (quiet ? 0 : data.failures ?? 0) + 1
      const over = failures - MAX_FAILURES
      const blockMs = over >= 0 ? Math.min(BASE_BLOCK_MS * 2 ** over, MAX_BLOCK_MS) : 0

      tx.set(ref, {
        failures,
        blockedUntil: blockMs > 0 ? new Date(now + blockMs) : null,
        updatedAt: new Date(now),
        expireAt: new Date(now + RATE_LIMIT_TTL_MS),
      })
    })
    return true
  })
}

const clearFailures = (db, key) => db.doc(`rateLimits/${key}`).delete().catch(() => {})

/**
 * The hash of a device token that was minted for this family under its current
 * password, or null. The deletion at a password change is what normally ends a
 * device; comparing the version as well means a token still stands for nothing
 * if that deletion failed. A device from before the field existed is version 0.
 */
async function knownDeviceHash(db, familyId, deviceToken) {
  if (typeof deviceToken !== 'string' || !DEVICE_TOKEN.test(deviceToken)) return null
  const hash = sha256(deviceToken)
  const snap = await db.collection(DEVICES).doc(hash).get()
  if (!snap.exists || snap.data().familyId !== familyId) return null
  const familySnap = await db.doc(`families/${familyId}`).get()
  return (snap.data().sv ?? 0) === (familySnap.data()?.viewerSessionVersion || 0) ? hash : null
}

/**
 * The session version to put in the token, read together with the hash that
 * was compared. A password change writes both in one batch, so this is either
 * the old password with the old version or the new with the new: a login that
 * checked the old password cannot come away with the new version. Null when
 * the stored hash is no longer the one that matched.
 */
function sessionOf(db, familyId, hash) {
  return db.runTransaction(async (tx) => {
    const [secretSnap, familySnap] = await Promise.all([
      tx.get(db.doc(`families/${familyId}/secrets/auth`)),
      tx.get(db.doc(`families/${familyId}`)),
    ])
    if (!secretSnap.exists || secretSnap.data().sharedPassword !== hash) return null
    return { sv: familySnap.data()?.viewerSessionVersion || 0 }
  })
}

/**
 * Replace the shared password. The hash and the version bump are one batch:
 * written one after the other, a login could slip in between them.
 *
 * @param {object} deps
 * @param {any} deps.db
 * @param {(n: number) => unknown} deps.increment  FieldValue.increment, passed in to keep this module free of firebase-admin
 * @param {() => number} [deps.now]
 */
export async function replaceSharedPassword({ db, increment, now = Date.now }, familyId, hash) {
  const batch = db.batch()
  batch.set(db.doc(`families/${familyId}/secrets/auth`), { sharedPassword: hash, updatedAt: new Date(now()) })
  batch.update(db.doc(`families/${familyId}`), { viewerSessionVersion: increment(1) })
  await batch.commit()
}

/** Forget every remembered device of a family, a batch at a time. @returns {Promise<number>} how many */
export async function forgetViewerDevices(db, familyId) {
  let deleted = 0
  for (;;) {
    const page = await db.collection(DEVICES).where('familyId', '==', familyId).limit(DEVICE_PAGE).get()
    if (page.docs.length === 0) return deleted
    const batch = db.batch()
    for (const snap of page.docs) batch.delete(snap.ref)
    await batch.commit()
    deleted += page.docs.length
  }
}

/**
 * @param {object} deps
 * @param {import('firebase-admin/firestore').Firestore} deps.db
 * @param {(password: string, hash: string) => Promise<boolean>} deps.compare
 * @param {(familyId: string, sv: number) => Promise<string>} deps.mintToken  custom auth token for the family's viewer identity, with the session version `sv`
 * @param {() => number} [deps.now]
 * @param {(event: { familyId: string, outcome: 'ok'|'denied'|'blocked', device: 'new'|'known' }) => void} [deps.log]
 * @param {{ familyId?: unknown, password?: unknown, deviceToken?: unknown }} input
 * @returns {Promise<
 *   | { outcome: 'ok', token: string, deviceToken?: string }
 *   | { outcome: 'blocked' }
 *   | { outcome: 'denied' }
 * >} `deviceToken` only when a new one was minted
 */
export async function checkViewerLogin(deps, input) {
  const { db, compare, mintToken, now = Date.now, log } = deps
  const familyId = String(input.familyId ?? '')
  const password = String(input.password ?? '')

  const report = (result, device) => {
    log?.({ familyId, outcome: result.outcome, device })
    return result
  }

  // Nothing to guess against: answer like a wrong password, without work.
  if (!FAMILY_ID.test(familyId) || !password) return report({ outcome: 'denied' }, 'new')

  const deviceHash = await knownDeviceHash(db, familyId, input.deviceToken)
  const device = deviceHash ? 'known' : 'new'
  // A new device shares the family's counter and budget; a known one has its
  // own. The caller's address is no key: it is whatever the caller claims.
  const keys = deviceHash ? [`viewerDevice__${deviceHash}`] : [safeKey('viewerLogin', familyId)]
  const budgetKeys = deviceHash
    ? [`viewerDeviceBudget__${deviceHash}`]
    : [safeKey('viewerLoginBudget', familyId)]

  // Before any work — the bcrypt comparison is deliberately expensive, so an
  // attacker must not be able to make us run it. Reserving the attempt here
  // also counts it, so a wrong guess needs no recording afterwards, and it
  // counts the right password too: that is what the daily budget is for.
  // A transaction that keeps losing to others on the same counter gives up
  // with ABORTED. That only happens under a burst of attempts, so it is
  // answered like a block: the comparison is not run, and the caller gets a
  // clear answer instead of an internal error.
  const reserved = await reserveAttempt(db, keys, budgetKeys, now()).catch((err) => {
    if (err?.code === 10 || err?.code === 'aborted') return false
    throw err
  })
  if (!reserved) return report({ outcome: 'blocked' }, device)

  // The only place a hash lives.
  const secretSnap = await db.doc(`families/${familyId}/secrets/auth`).get()
  const hash = secretSnap.exists ? secretSnap.data().sharedPassword : null

  if (!hash || !(await compare(password, hash))) return report({ outcome: 'denied' }, device)

  // The comparison takes a while, long enough for the password to change under
  // it. The attempt then counts as a failure, like any other wrong password.
  const session = await sessionOf(db, familyId, hash)
  if (!session) return report({ outcome: 'denied' }, device)

  await Promise.all(keys.map((key) => clearFailures(db, key)))
  const token = await mintToken(familyId, session.sv)

  if (deviceHash) {
    const at = now()
    await db
      .collection(DEVICES)
      .doc(deviceHash)
      .update({ lastUsedAt: new Date(at), expireAt: new Date(at + DEVICE_TTL_MS) })
      .catch(() => {})
    return report({ outcome: 'ok', token }, device)
  }

  const deviceToken = randomBytes(32).toString('base64url')
  const at = now()
  await db.collection(DEVICES).doc(sha256(deviceToken)).set({
    familyId,
    sv: session.sv,
    createdAt: new Date(at),
    lastUsedAt: new Date(at),
    expireAt: new Date(at + DEVICE_TTL_MS),
  })
  return report({ outcome: 'ok', token, deviceToken }, device)
}
