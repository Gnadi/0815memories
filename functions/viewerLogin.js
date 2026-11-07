/**
 * Viewer login: check a family's shared password, and throttle the guessing.
 *
 * The throttle used to key on the family alone (plus the caller's IP), and a
 * blocked family refused everyone — the right password included. Family ids
 * are public, so anyone could keep a family's viewers locked out with a few
 * wrong guesses every quarter of an hour. The IP key was no help: Cloud
 * Functions trusts X-Forwarded-For, so `req.ip` is whatever the caller says.
 *
 * So a device that has signed in before now carries a device token, minted on
 * its first successful login. With it, the family-wide block does not apply:
 * the device is throttled on its own failures instead. Only devices that have
 * never signed in — which is who a password guesser is — still share the
 * family's limit, and still hit it.
 *
 * A device token grants nothing by itself. It exempts from the family's
 * lockout, not from the password. Only its hash is stored.
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
 * blocked. The attempts are counted before the password is compared, in one
 * transaction, so that concurrent requests are serialised on the counter and
 * cannot all pass the check before any of them is recorded. A successful
 * login clears the records again.
 *
 * The counter starts over only after a quiet period: FAILURE_WINDOW_MS since
 * the last attempt, or since the end of the last block if that came later. It
 * never starts over while a block is active, so the blocks keep growing for as
 * long as someone keeps guessing.
 *
 * @returns {Promise<boolean>} whether the attempt may go on to the comparison
 */
async function reserveAttempt(db, keys, now) {
  const refs = keys.map((key) => db.doc(`rateLimits/${key}`))
  return db.runTransaction(async (tx) => {
    // All reads come before the first write.
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)))
    const records = snaps.map((snap) => (snap.exists ? snap.data() : null))

    if (records.some((data) => (data?.blockedUntil?.toMillis?.() ?? 0) > now)) return false

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
      })
    })
    return true
  })
}

const clearFailures = (db, key) => db.doc(`rateLimits/${key}`).delete().catch(() => {})

/** The hash of a device token that was minted for this family, or null. */
async function knownDeviceHash(db, familyId, deviceToken) {
  if (typeof deviceToken !== 'string' || !DEVICE_TOKEN.test(deviceToken)) return null
  const hash = sha256(deviceToken)
  const snap = await db.collection(DEVICES).doc(hash).get()
  return snap.exists && snap.data().familyId === familyId ? hash : null
}

/**
 * @param {object} deps
 * @param {import('firebase-admin/firestore').Firestore} deps.db
 * @param {(password: string, hash: string) => Promise<boolean>} deps.compare
 * @param {(familyId: string) => Promise<string>} deps.mintToken  custom auth token
 * @param {() => number} [deps.now]
 * @param {{ familyId?: unknown, password?: unknown, deviceToken?: unknown, ip?: unknown }} input
 * @returns {Promise<
 *   | { outcome: 'ok', token: string, deviceToken?: string }
 *   | { outcome: 'blocked' }
 *   | { outcome: 'denied' }
 * >} `deviceToken` only when a new one was minted
 */
export async function checkViewerLogin(deps, input) {
  const { db, compare, mintToken, now = Date.now } = deps
  const familyId = String(input.familyId ?? '')
  const password = String(input.password ?? '')

  // Nothing to guess against: answer like a wrong password, without work.
  if (!FAMILY_ID.test(familyId) || !password) return { outcome: 'denied' }

  const deviceHash = await knownDeviceHash(db, familyId, input.deviceToken)
  const keys = deviceHash
    ? [`viewerDevice__${deviceHash}`]
    : [safeKey('viewerLogin', familyId), safeKey('viewerLoginIp', input.ip || 'unknown')]

  // Before any work — the bcrypt comparison is deliberately expensive, so an
  // attacker must not be able to make us run it. Reserving the attempt here
  // also counts it, so a wrong guess needs no recording afterwards.
  // A transaction that keeps losing to others on the same counter gives up
  // with ABORTED. That only happens under a burst of attempts, so it is
  // answered like a block: the comparison is not run, and the caller gets a
  // clear answer instead of an internal error.
  const reserved = await reserveAttempt(db, keys, now()).catch((err) => {
    if (err?.code === 10 || err?.code === 'aborted') return false
    throw err
  })
  if (!reserved) return { outcome: 'blocked' }

  // The only place a hash lives.
  const secretSnap = await db.doc(`families/${familyId}/secrets/auth`).get()
  const hash = secretSnap.exists ? secretSnap.data().sharedPassword : null

  if (!hash || !(await compare(password, hash))) return { outcome: 'denied' }

  await Promise.all(keys.map((key) => clearFailures(db, key)))
  const token = await mintToken(familyId)

  if (deviceHash) {
    await db.collection(DEVICES).doc(deviceHash).update({ lastUsedAt: new Date(now()) }).catch(() => {})
    return { outcome: 'ok', token }
  }

  const deviceToken = randomBytes(32).toString('base64url')
  await db.collection(DEVICES).doc(sha256(deviceToken)).set({
    familyId,
    createdAt: new Date(now()),
    lastUsedAt: new Date(now()),
  })
  return { outcome: 'ok', token, deviceToken }
}
