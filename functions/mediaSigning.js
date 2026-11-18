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

// Cloudinary accepts a signature's timestamp for an hour. The family deletion
// waits this long, plus a margin for an upload that started late, before it
// trusts that a `pending` ledger entry will never get a file.
export const SIGNATURE_VALID_MS = 60 * 60 * 1000
export const SIGNATURE_MARGIN_MS = 15 * 60 * 1000

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

// The most uploads one call signs. A photo is two files (the original and its
// thumbnail), so this covers a choice of ten photos in one call; the browser
// sends a larger choice as several.
export const MAX_BATCH = 20

export class SigningError extends Error {
  /**
   * @param {'unauthenticated'|'invalid-argument'|'permission-denied'|'failed-precondition'|'resource-exhausted'} code
   * @param {string} message
   * @param {{ reason: 'rate'|'storage' }} [details]  sent to the browser with a refused quota
   */
  constructor(code, message, details) {
    super(message)
    this.code = code
    this.details = details
  }
}

// The marker collection of functions/familyDeletion.js, which imports this
// module and so cannot be imported here.
const FAMILY_DELETIONS = 'familyDeletions'

const millisOf = (value) => {
  if (value == null) return NaN
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return Number(value)
}

/** Has the family's deletion begun, or is its date reached? `marker` is the familyDeletions document, if read. */
function deletionHasBegun(familyData, marker, at) {
  if (marker?.exists) return true
  return millisOf(familyData?.deletion?.deleteAfter) <= at
}

function adminUidsOf(data) {
  return Array.isArray(data?.adminUids) ? data.adminUids : []
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
 * How many of `wanted` uploads are allowed, and the admin's rate after them.
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
 * A batch near a limit gets the part of it that fits rather than nothing, so
 * the uploads it covers go through as they would have one at a time; the
 * browser asks again for the rest and is told which limit refused them.
 *
 * @param {{ rate?: { windowStart?: number, count?: number } | null, usage?: { bytes?: number, unsized?: number } | null }} state
 * @param {number} now
 * @param {{ uploadsPerHour: number, familyBytes: number, maxFileBytes: number }} limits
 * @param {number} [wanted]
 * @returns {{ allowed: true, granted: number, rate: { windowStart: number, count: number } } | { allowed: false, reason: 'rate'|'storage' }}
 */
export function checkQuota({ rate, usage }, now, limits, wanted = 1) {
  const current = rate && Number.isFinite(rate.windowStart) && now - rate.windowStart < RATE_WINDOW_MS
  const windowStart = current ? rate.windowStart : now
  const count = current ? (Number(rate.count) || 0) : 0
  const rateLeft = limits.uploadsPerHour - count
  if (rateLeft <= 0) return { allowed: false, reason: 'rate' }
  const stored = (Number(usage?.bytes) || 0) + (Number(usage?.unsized) || 0) * limits.maxFileBytes
  const storageLeft = Math.floor((limits.familyBytes - stored) / limits.maxFileBytes)
  if (storageLeft <= 0) return { allowed: false, reason: 'storage' }
  const granted = Math.min(wanted, rateLeft, storageLeft)
  return { allowed: true, granted, rate: { windowStart, count: count + granted } }
}

/** Random, URL-safe, and long enough that nobody guesses another file's id. */
const defaultRandomId = () => randomBytes(16).toString('hex')

/**
 * Sign uploads for an admin of `data.familyId`, and record them as pending.
 *
 * The family comes from the browser — the one it is working in — and is
 * checked against the family document rather than the caller's claim, which
 * names only one family and may lag a moment behind a new admin. It has to be
 * the right family: a later phase deletes files that no document of their own
 * family uses.
 *
 * Quotas are checked in the same transaction that records the files, so two
 * uploads at once cannot both take the last one. That transaction writes the
 * admin's rate and the family's usage, two documents every upload shares; one
 * call per file made a choice of ten photos twenty transactions queueing on
 * them, which is why the browser asks for several files at once
 * (`data.count`) and gets them from one.
 *
 * Without `count` the answer is one signature, as before batches; with it,
 * `{ uploads }`, which holds fewer than asked for when a limit leaves room for
 * only some.
 *
 * @param {{ db: any, apiKey: string, secret: string, limits: { uploadsPerHour: number, familyBytes: number, maxFileBytes: number }, now?: () => number, randomId?: () => string }} deps
 * @param {string|undefined} uid  the caller, from the verified ID token
 * @param {{ familyId?: unknown, kind?: unknown, count?: unknown }} data
 * @returns {Promise<Signed | { uploads: Signed[] }>}
 *
 * @typedef {{ apiKey: string, signature: string, resourceType: string, publicId: string, params: Record<string, string|number> }} Signed
 */
export async function signUpload(deps, uid, data) {
  const { db, apiKey, secret, limits, now = Date.now, randomId = defaultRandomId } = deps
  if (!uid) throw new SigningError('unauthenticated', 'Sign in first')

  const familyId = typeof data?.familyId === 'string' ? data.familyId : ''
  if (!FAMILY_ID.test(familyId)) throw new SigningError('invalid-argument', 'No family given')

  const kindName = data?.kind ?? 'encrypted'
  const kind = Object.hasOwn(UPLOAD_KINDS, kindName) ? UPLOAD_KINDS[kindName] : null
  if (!kind) throw new SigningError('invalid-argument', 'Unknown upload kind')

  const batch = data?.count !== undefined
  const wanted = batch ? data.count : 1
  if (!Number.isInteger(wanted) || wanted < 1 || wanted > MAX_BATCH) {
    throw new SigningError('invalid-argument', `Ask for 1 to ${MAX_BATCH} uploads`)
  }

  const createdAtMs = now()
  const familyRef = db.doc(`families/${familyId}`)
  const family = await familyRef.get()
  if (!family.exists || !adminUidsOf(family.data()).includes(uid)) {
    throw new SigningError('permission-denied', 'Only family admins can upload')
  }

  // A family being deleted takes no new files: the deletion would race the
  // upload and could report success with the file left behind. Checked again in
  // the transaction below, against the marker the deletion writes.
  if (deletionHasBegun(family.data(), null, createdAtMs)) {
    throw new SigningError('failed-precondition', 'This family is being deleted')
  }

  const createdAt = new Date(createdAtMs)
  const rateRef = db.collection(MEDIA_RATES).doc(uid)
  const usageRef = db.collection(MEDIA_USAGE).doc(familyId)

  const quota = await db.runTransaction(async (tx) => {
    const [rate, usage, familyNow, marker] = await Promise.all([
      tx.get(rateRef),
      tx.get(usageRef),
      tx.get(familyRef),
      tx.get(db.collection(FAMILY_DELETIONS).doc(familyId)),
    ])
    if (!familyNow.exists || deletionHasBegun(familyNow.data(), marker, createdAtMs)) {
      throw new SigningError('failed-precondition', 'This family is being deleted')
    }
    // Asked again here, where it is decided: an admin removed between the
    // check above and this transaction would otherwise still get signatures.
    if (!adminUidsOf(familyNow.data()).includes(uid)) {
      throw new SigningError('permission-denied', 'Only family admins can upload')
    }
    const decision = checkQuota(
      { rate: rate.exists ? rate.data() : null, usage: usage.exists ? usage.data() : null },
      createdAt.getTime(),
      limits,
      wanted,
    )
    if (!decision.allowed) return decision

    const current = usage.exists ? usage.data() : {}
    tx.set(rateRef, decision.rate)
    tx.set(usageRef, {
      bytes: Number(current.bytes) || 0,
      files: Number(current.files) || 0,
      unsized: (Number(current.unsized) || 0) + decision.granted,
    })
    // Picked inside the transaction, so a retried attempt records the same
    // number of files it counted, and written before the signatures leave, so
    // there is no file the ledger does not know about. An entry whose upload
    // never happens stays pending, and the clean-up removes it.
    const publicIds = []
    for (let i = 0; i < decision.granted; i++) {
      const assetId = randomId()
      const publicId = `${kind.prefix}/${familyId}/${assetId}`
      publicIds.push(publicId)
      tx.set(db.collection(MEDIA_ASSETS).doc(assetId), {
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
    }
    return { ...decision, publicIds }
  })

  if (!quota.allowed) {
    throw new SigningError('resource-exhausted', 'Upload limit reached', { reason: quota.reason })
  }

  const uploads = quota.publicIds.map((publicId) => {
    // Signed uploads overwrite by default, so `overwrite` is signed as false: a
    // second upload with the same signature lands on the same public_id and
    // stores nothing new. The tag lets Cloudinary's console and Admin API find
    // a family's files without the ledger.
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
  })
  return batch ? { uploads } : uploads[0]
}
