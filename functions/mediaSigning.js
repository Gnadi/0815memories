/**
 * Upload signatures for Cloudinary — the first phase of
 * docs/plan-media-lifecycle.md.
 *
 * api/cloudinary-sign, the Vercel function this replaced, signed only `folder`
 * and `timestamp`. Cloudinary accepts a timestamp for an hour, so one signature
 * allowed any number of uploads of any resource type in that hour, and nothing recorded what was uploaded or for
 * whom. Here the server picks the file's `public_id` and signs it, so one
 * signature is one file, and it writes that file into the `mediaAssets` ledger
 * before the browser has sent a byte. Later phases attach ledger entries to the
 * documents that use them and delete the ones nothing uses; this one only makes
 * sure every new file is in the ledger.
 *
 * Nothing here imports firebase-admin or firebase-functions: Firestore, the
 * clock and the random source come in as arguments, so the tests can stub them.
 */
import { createHash, randomBytes } from 'node:crypto'

export const MEDIA_ASSETS = 'mediaAssets'
// Per family: `bytes` and `files`, the size of every file whose size is known
// (functions/mediaSizes.js asks Cloudinary for it), and `unsized`, the files
// signed whose size is not known yet. Files from before the ledger are counted
// once the inventory has found them (functions/mediaInventory.js).
export const MEDIA_USAGE = 'mediaUsage'
// Per admin: how many uploads they were signed in the current hour.
export const MEDIA_RATES = 'mediaRates'

export const RATE_WINDOW_MS = 60 * 60 * 1000

// What the browser may ask for. Family content is ciphertext, which Cloudinary
// cannot decode, so it goes up as `raw`. The exception is a picture shown
// without the family key — the login page's header above all (UploadWidget's
// `unencrypted`): a plain image, kept under its own prefix so it can never be
// mistaken for family content.
export const UPLOAD_KINDS = {
  encrypted: { resourceType: 'raw', prefix: 'kaydo' },
  public: { resourceType: 'image', prefix: 'kaydo/public' },
}

const FAMILY_ID = /^[A-Za-z0-9_-]{1,100}$/

export class SigningError extends Error {
  /**
   * @param {'unauthenticated'|'invalid-argument'|'permission-denied'|'resource-exhausted'} code
   * @param {string} message
   * @param {{ reason: 'rate'|'storage' }} [details]  sent to the browser with a refused quota
   */
  constructor(code, message, details) {
    super(message)
    this.code = code
    this.details = details
  }
}

function adminUidsOf(data) {
  if (!data) return []
  const list = Array.isArray(data.adminUids) ? data.adminUids : []
  if (list.length > 0) return list
  return data.adminUid ? [data.adminUid] : []
}

/**
 * Cloudinary's signature: the parameters sorted by name, joined as
 * `key=value&…`, the API secret appended, hashed and in hex.
 * https://cloudinary.com/documentation/authentication_signatures
 *
 * SHA-256 rather than the SDKs' default SHA-1: Cloudinary accepts either
 * digest on every account without any setting (it is what the SDKs'
 * `signature_algorithm: 'sha256'` does), and SHA-1 is a broken hash that
 * code scanning rightly flags next to a secret.
 */
export function cloudinarySignature(params, secret) {
  const joined = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  return createHash('sha256').update(`${joined}${secret}`).digest('hex')
}

/**
 * Whether one more upload is allowed, and the admin's rate after it.
 *
 * The rate is a fixed window that starts with the first upload after the
 * previous one ran out — simple, and an hour is long enough that its edges do
 * not matter.
 *
 * Storage counts every file whose size is not known yet as if it were as large
 * as a file can be (`maxFileBytes`, the plan's cap per file, which Cloudinary
 * enforces however the browser was changed). Sizes are only looked up once a
 * day, and an admin can sign hundreds of uploads in an hour: counting them at
 * their smallest would let a family overrun its storage by a day's worth.
 * Counting them at their largest can refuse an upload a little early, never
 * let one through too late, and the daily lookup puts the real sizes in.
 *
 * @param {{ rate?: { windowStart?: number, count?: number } | null, usage?: { bytes?: number, unsized?: number } | null }} state
 * @param {number} now
 * @param {{ uploadsPerHour: number, familyBytes: number, maxFileBytes: number }} limits
 * @returns {{ allowed: true, rate: { windowStart: number, count: number } } | { allowed: false, reason: 'rate'|'storage' }}
 */
export function checkQuota({ rate, usage }, now, limits) {
  const current = rate && Number.isFinite(rate.windowStart) && now - rate.windowStart < RATE_WINDOW_MS
  const windowStart = current ? rate.windowStart : now
  const count = current ? (Number(rate.count) || 0) : 0
  if (count >= limits.uploadsPerHour) return { allowed: false, reason: 'rate' }
  const stored = (Number(usage?.bytes) || 0) + (Number(usage?.unsized) || 0) * limits.maxFileBytes
  if (stored + limits.maxFileBytes > limits.familyBytes) return { allowed: false, reason: 'storage' }
  return { allowed: true, rate: { windowStart, count: count + 1 } }
}

/** Random, URL-safe, and long enough that nobody guesses another file's id. */
const defaultRandomId = () => randomBytes(16).toString('hex')

/**
 * Sign one upload for an admin of `data.familyId`, and record it as pending.
 *
 * The family comes from the browser — the one it is working in — and is
 * checked against the family document rather than the caller's claim, which
 * names only one family and may lag a moment behind a new admin. It has to be
 * the right family: a later phase deletes files that no document of their own
 * family uses.
 *
 * Quotas are checked in the same transaction that records the file, so two
 * uploads at once cannot both take the last one.
 *
 * @param {{ db: any, apiKey: string, secret: string, limits: { uploadsPerHour: number, familyBytes: number, maxFileBytes: number }, now?: () => number, randomId?: () => string }} deps
 * @param {string|undefined} uid  the caller, from the verified ID token
 * @param {{ familyId?: unknown, kind?: unknown }} data
 * @returns {Promise<{ apiKey: string, signature: string, resourceType: string, publicId: string, params: Record<string, string|number> }>}
 */
export async function signUpload(deps, uid, data) {
  const { db, apiKey, secret, limits, now = Date.now, randomId = defaultRandomId } = deps
  if (!uid) throw new SigningError('unauthenticated', 'Sign in first')

  const familyId = typeof data?.familyId === 'string' ? data.familyId : ''
  if (!FAMILY_ID.test(familyId)) throw new SigningError('invalid-argument', 'No family given')

  const kindName = data?.kind ?? 'encrypted'
  const kind = Object.hasOwn(UPLOAD_KINDS, kindName) ? UPLOAD_KINDS[kindName] : null
  if (!kind) throw new SigningError('invalid-argument', 'Unknown upload kind')

  const family = await db.doc(`families/${familyId}`).get()
  if (!family.exists || !adminUidsOf(family.data()).includes(uid)) {
    throw new SigningError('permission-denied', 'Only family admins can upload')
  }

  const assetId = randomId()
  const publicId = `${kind.prefix}/${familyId}/${assetId}`
  const createdAt = new Date(now())
  const rateRef = db.collection(MEDIA_RATES).doc(uid)
  const usageRef = db.collection(MEDIA_USAGE).doc(familyId)
  const assetRef = db.collection(MEDIA_ASSETS).doc(assetId)

  const quota = await db.runTransaction(async (tx) => {
    const [rate, usage] = await Promise.all([tx.get(rateRef), tx.get(usageRef)])
    const decision = checkQuota(
      { rate: rate.exists ? rate.data() : null, usage: usage.exists ? usage.data() : null },
      createdAt.getTime(),
      limits,
    )
    if (!decision.allowed) return decision

    const current = usage.exists ? usage.data() : {}
    tx.set(rateRef, decision.rate)
    tx.set(usageRef, {
      bytes: Number(current.bytes) || 0,
      files: Number(current.files) || 0,
      unsized: (Number(current.unsized) || 0) + 1,
    })
    // Written before the signature leaves, so there is no file the ledger does
    // not know about. An entry whose upload never happens stays pending, and is
    // what the clean-up of abandoned uploads will remove.
    tx.set(assetRef, {
      familyId,
      uid,
      kind: kindName,
      publicId,
      resourceType: kind.resourceType,
      state: 'pending',
      refs: [],
      // null until the daily lookup finds the file on Cloudinary
      // (functions/mediaSizes.js), which queries for exactly this.
      bytes: null,
      createdAt,
    })
    return decision
  })

  if (!quota.allowed) {
    throw new SigningError('resource-exhausted', 'Upload limit reached', { reason: quota.reason })
  }

  // Signed uploads overwrite by default, so `overwrite` is signed as false: a
  // second upload with the same signature lands on the same public_id and
  // stores nothing new. The tag lets Cloudinary's console and Admin API find a
  // family's files without the ledger.
  const params = {
    overwrite: 'false',
    public_id: publicId,
    tags: `family:${familyId}`,
    timestamp: Math.floor(createdAt.getTime() / 1000),
  }

  return {
    apiKey,
    signature: cloudinarySignature(params, secret),
    resourceType: kind.resourceType,
    publicId,
    params,
  }
}
