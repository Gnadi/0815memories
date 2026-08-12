/**
 * Vercel Serverless Function — FCM push dispatcher.
 *
 * Replaces the `dispatchPushNotifications` Cloud Function, which required the
 * Firebase Blaze plan. Vercel's Hobby plan runs this for free, and the app is
 * deployed there anyway (see api/cloudinary-sign.js).
 *
 * Sending an FCM message needs an OAuth token minted from a service account —
 * a browser cannot do that without shipping the key in the bundle. So the
 * client stays the *trigger* (right after a memory is created, or when an admin
 * opens the family) and this endpoint does the sending.
 *
 * Required environment variable in Vercel (server-side only, never in .env.local):
 *   FIREBASE_SERVICE_ACCOUNT_JSON — the service account key, as a JSON string
 *
 * Request:  POST { idToken, familyId, kind, params?, excludeToken? }
 * Response: { sent, failed }
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { buildPushMessage, PUSH_KINDS } from '../src/utils/pushMessages.js'

// FCM error codes that mean "this specific device is gone" and nothing else.
// Anything broader (a transient network error, a malformed payload) must NOT
// delete tokens — a bad payload fails for every device at once and would empty
// the whole collection.
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
])

// Firestore document ids, which is all `memoryId` is ever allowed to be.
const DOC_ID = /^[A-Za-z0-9_-]{1,128}$/

function ensureApp() {
  if (getApps().length) return true
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) return false
  initializeApp({ credential: cert(JSON.parse(raw)) })
  return true
}

// Mirrors isFamilyAdmin() in firestore.rules, including the pre-adminUids
// fallback for families that never went through the lazy migration.
function isFamilyAdmin(familyData, uid) {
  if (!familyData) return false
  const admins = Array.isArray(familyData.adminUids)
    ? familyData.adminUids
    : [familyData.adminUid]
  return admins.includes(uid)
}

// Only structured values reach the message builder — never free text from the
// client, so a caller cannot put arbitrary (or encrypted) content into a push.
function sanitizeParams(kind, params) {
  const p = params ?? {}
  if (kind === 'memory') {
    return DOC_ID.test(p.memoryId ?? '') ? { memoryId: p.memoryId } : {}
  }
  if (kind === 'anniversary') {
    const count = Number(p.count)
    const year = Number(p.year)
    if (!Number.isInteger(count) || count < 1 || !Number.isInteger(year)) return null
    return { count, year }
  }
  return {}
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  if (!ensureApp()) {
    return res.status(500).json({ error: 'FIREBASE_SERVICE_ACCOUNT_JSON not configured' })
  }

  const { idToken, familyId, kind, params, excludeToken } = req.body ?? {}

  if (typeof familyId !== 'string' || !familyId) {
    return res.status(400).json({ error: 'familyId required' })
  }
  if (!PUSH_KINDS.includes(kind)) {
    return res.status(400).json({ error: 'unknown kind' })
  }

  const safeParams = sanitizeParams(kind, params)
  if (safeParams === null) {
    return res.status(400).json({ error: 'invalid params' })
  }

  // Authorisation: a valid Firebase session that is an admin of *this* family.
  // Without it, anyone who learned a familyId could push into someone else's
  // household — family docs are world-readable (see firestore.rules).
  let uid
  try {
    ;({ uid } = await getAuth().verifyIdToken(idToken))
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const db = getFirestore()
  const familySnap = await db.collection('families').doc(familyId).get()
  if (!isFamilyAdmin(familySnap.data(), uid)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const tokenSnap = await db.collection('fcmTokens').where('familyId', '==', familyId).get()

  // Skip the device that triggered this — nobody needs a notification about the
  // memory they just added themselves.
  const targets = tokenSnap.docs.filter((d) => {
    const token = d.data().token
    return token && token !== excludeToken
  })

  if (targets.length === 0) return res.status(200).json({ sent: 0, failed: 0 })

  const messaging = getMessaging()
  const results = await Promise.allSettled(
    targets.map((d) => {
      const { token, lang } = d.data()
      // Data-only on purpose: the service worker's push handler renders the
      // notification itself (src/sw.js), which a `notification` block would
      // pre-empt. Language is resolved per recipient device.
      const { title, body, url } = buildPushMessage(kind, lang, safeParams)
      return messaging.send({ token, data: { title, body, url } })
    })
  )

  const dead = targets.filter((_, i) => {
    const r = results[i]
    return r.status === 'rejected' && DEAD_TOKEN_CODES.has(r.reason?.code)
  })
  await Promise.allSettled(dead.map((d) => d.ref.delete()))

  const sent = results.filter((r) => r.status === 'fulfilled').length
  console.log(
    `[push] kind=${kind} family=${familyId} sent=${sent} failed=${results.length - sent} pruned=${dead.length}`
  )

  return res.status(200).json({ sent, failed: results.length - sent })
}
