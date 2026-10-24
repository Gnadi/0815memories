/**
 * Cloudinary's upload notifications — phase 2 of docs/plan-media-lifecycle.md.
 *
 * signUpload records a file before it exists, so the ledger cannot know its
 * size. Every signature names this function's URL as `notification_url`, and
 * Cloudinary calls it once the file is stored. The size goes onto the file's
 * ledger entry and into its family's usage, which is what the storage quota in
 * signUpload reads.
 *
 * Anyone can call the URL, so nothing is believed without Cloudinary's
 * signature over the body, and nothing is recorded for a file the ledger does
 * not already know. Each file is counted once: Cloudinary retries a
 * notification it thinks failed, and anyone can resend one it signed.
 *
 * Nothing here imports firebase-admin or firebase-functions, so the tests can
 * hand in a stand-in for Firestore.
 *
 * https://cloudinary.com/documentation/notifications#verifying_notification_signatures
 */
import { createHash, timingSafeEqual } from 'node:crypto'
import { MEDIA_ASSETS, MEDIA_USAGE } from './mediaSigning.js'

// Cloudinary retries a failed notification for a while; a signed one older
// than this is not worth acting on. Replays inside it are harmless — a file is
// only ever counted once.
export const NOTIFICATION_MAX_AGE_MS = 24 * 60 * 60 * 1000

const sameHex = (a, b) => {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  return left.length === right.length && timingSafeEqual(left, right)
}

/**
 * Is this body what Cloudinary sent? Its signature is the hash of the body,
 * the timestamp header and the API secret, in the digest the account is set
 * to: SHA-1 unless Cloudinary was asked to change it, SHA-256 if it was. So
 * both are accepted here — unlike uploads, which we sign ourselves and sign
 * with SHA-256 (functions/mediaSigning.js).
 *
 * @param {Buffer|string|undefined} rawBody  the bytes as received, not re-serialised JSON
 * @param {string|undefined} timestamp  X-Cld-Timestamp, in seconds
 * @param {string|undefined} signature  X-Cld-Signature, hex
 */
export function verifyNotification(rawBody, timestamp, signature, secret, now = Date.now()) {
  if (!rawBody || !secret || typeof timestamp !== 'string' || typeof signature !== 'string') return false
  const seconds = Number(timestamp)
  if (!/^\d+$/.test(timestamp) || Math.abs(now - seconds * 1000) > NOTIFICATION_MAX_AGE_MS) return false

  const signed = Buffer.concat([Buffer.from(rawBody), Buffer.from(`${timestamp}${secret}`, 'utf8')])
  const given = signature.toLowerCase()
  return ['sha1', 'sha256'].some((algorithm) =>
    sameHex(createHash(algorithm).update(signed).digest('hex'), given))
}

/**
 * Put the size Cloudinary reported onto the file's ledger entry and add it to
 * the family's usage, in one transaction.
 *
 * @param {{ db: any, now?: () => number }} deps
 * @param {any} payload  the notification, parsed
 * @returns {Promise<'recorded'|'ignored'|'unknown'|'duplicate'>}
 */
export async function recordUpload({ db, now = Date.now }, payload) {
  if (payload?.notification_type !== 'upload') return 'ignored'
  const publicId = typeof payload.public_id === 'string' ? payload.public_id : ''
  const bytes = Number(payload.bytes)
  if (!publicId || !Number.isFinite(bytes) || bytes < 0) return 'ignored'

  // The ledger id is the last segment of the public_id signUpload made.
  const assetRef = db.collection(MEDIA_ASSETS).doc(publicId.split('/').pop())

  return db.runTransaction(async (tx) => {
    const asset = await tx.get(assetRef)
    const entry = asset.exists ? asset.data() : null
    if (!entry || entry.publicId !== publicId) return 'unknown'
    if (entry.bytes != null) return 'duplicate'

    const usageRef = db.collection(MEDIA_USAGE).doc(entry.familyId)
    const usage = await tx.get(usageRef)
    const current = usage.exists ? usage.data() : {}

    tx.update(assetRef, { bytes, uploadedAt: new Date(now()) })
    tx.set(usageRef, {
      bytes: (Number(current.bytes) || 0) + bytes,
      files: (Number(current.files) || 0) + 1,
    })
    return 'recorded'
  })
}
