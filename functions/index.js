/**
 * Firebase Cloud Functions — FCM Push Dispatcher
 *
 * dispatchPushNotifications:
 *   Triggered when a document is created in the `notificationsQueue` collection.
 *   Reads FCM tokens for the family, sends push messages, then deletes the queue doc.
 *
 * The daily anniversary reminder is enqueued client-side by
 * useAnniversaryReminder when an admin opens the app — no scheduler, no
 * service-account JSON. This function still consumes the queue and fans out
 * to FCM tokens.
 *
 * No credentials needed — Firebase injects the service account automatically
 * when running inside Cloud Functions.
 *
 * Deployment:
 *   npm install -g firebase-tools
 *   firebase login
 *   firebase use <your-project-id>
 *   cd functions && npm install && cd ..
 *   firebase deploy --only functions
 */

import { firestore } from 'firebase-functions'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { setGlobalOptions } from 'firebase-functions/v2'
import { getAuth } from 'firebase-admin/auth'
import bcrypt from 'bcryptjs'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

// No credentials arg — Firebase injects them automatically in the Cloud Functions runtime
initializeApp()

// ---------------------------------------------------------------------------
// Cloud Function 1: dispatch FCM when a notificationsQueue doc is created
// ---------------------------------------------------------------------------

export const dispatchPushNotifications = firestore
  .document('notificationsQueue/{docId}')
  .onCreate(async (snapshot) => {
    const data = snapshot.data()

    // Always clean up the queue doc, even on early return
    const cleanup = () => snapshot.ref.delete().catch(() => {})

    if (!data) return cleanup()

    const { familyId, title, body, url } = data

    if (!familyId || !title) return cleanup()

    const db = getFirestore()
    const messaging = getMessaging()

    // Fetch all FCM tokens registered for this family
    const tokenSnapshot = await db
      .collection('fcmTokens')
      .where('familyId', '==', familyId)
      .get()

    const tokenDocs = tokenSnapshot.docs
    const tokens = tokenDocs.map((d) => d.data().token).filter(Boolean)

    if (tokens.length === 0) return cleanup()

    // Send data-only messages — the service worker push handler displays them,
    // giving full control over the notification appearance.
    const results = await Promise.allSettled(
      tokens.map((token) =>
        messaging.send({
          token,
          data: {
            title,
            body: body || '',
            url: url || '/',
          },
        })
      )
    )

    // Remove stale tokens that FCM rejected (e.g. unregistered devices)
    const staleTokenDocs = tokenDocs.filter((_, i) => results[i].status === 'rejected')
    await Promise.allSettled(staleTokenDocs.map((d) => d.ref.delete()))

    const sent = results.filter((r) => r.status === 'fulfilled').length
    console.log(`[push] sent=${sent} failed=${results.length - sent} family=${familyId}`)

    return cleanup()
  })


// ---------------------------------------------------------------------------
// Access control — see docs/plan-a-zugriffskontrolle.md
//
// Everything below exists because a viewer used to have no identity Firestore
// could check: loginAsViewer compared the password in the browser and set a
// flag in localStorage, so `request.auth` stayed null. That forced the family
// document — encryption key included — to be world-readable.
//
// These functions issue an identity instead: a custom token carrying a
// `familyId` claim, which firestore.rules can verify.
// ---------------------------------------------------------------------------

// v2 only — the v1 trigger above keeps whatever region it was deployed to.
// Changing a deployed function's region requires delete-and-recreate, and
// dispatchPushNotifications has no reason to move.
setGlobalOptions({ region: 'europe-west3', maxInstances: 10 })

// App Check keeps anonymous scripts off the login endpoint. It needs a
// reCAPTCHA key wired into the client first, so it is opt-in via env until
// that is configured — see the follow-up section of the plan. The rate limiter
// below does not depend on it.
const ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === 'true'

// The fields the login page is allowed to see before anyone authenticates.
// This list is the entire public surface of a family, and it lives here — on
// the server — so a field added to `families` later cannot leak by default.
const PUBLIC_FAMILY_FIELDS = [
  'familySlug',
  'familyName',
  'loginHeaderImage',
  'loginPageMode',
  'loginTheme',
  'loginCustomHtml',
  'loginCustomCss',
  'loginCard',
]

/** The admins of a family document, across both the legacy and current shape. */
function adminUidsOf(data) {
  if (!data) return []
  const list = Array.isArray(data.adminUids) ? data.adminUids : []
  if (list.length > 0) return list
  return data.adminUid ? [data.adminUid] : []
}

// ── 1. Public mirror ────────────────────────────────────────────────────────

export const mirrorFamilyPublic = onDocumentWritten('families/{familyId}', async (event) => {
  const { familyId } = event.params
  const after = event.data?.after
  const publicRef = getFirestore().doc(`familyPublic/${familyId}`)

  if (!after?.exists) {
    await publicRef.delete().catch(() => {})
    return
  }

  const data = after.data() || {}
  const mirror = {}
  for (const field of PUBLIC_FAMILY_FIELDS) {
    if (data[field] !== undefined) mirror[field] = data[field]
  }

  // set() without merge, so a field cleared on the private document is cleared
  // here too rather than lingering in public forever.
  await publicRef.set(mirror)
})

// ── 2. Admin claims ─────────────────────────────────────────────────────────

/**
 * Keep the `familyId` / `role: 'admin'` claim in step with `adminUids`.
 *
 * A trigger rather than a call at each site: signup, invite redemption and
 * admin removal all end in a write to this one document, so this is the single
 * place where admin status is decided. A future flow that adds an admin gets
 * the claim without knowing this function exists.
 */
export const syncAdminClaims = onDocumentWritten('families/{familyId}', async (event) => {
  const { familyId } = event.params
  const before = adminUidsOf(event.data?.before?.exists ? event.data.before.data() : null)
  const after = adminUidsOf(event.data?.after?.exists ? event.data.after.data() : null)

  const added = after.filter((uid) => !before.includes(uid))
  const removed = before.filter((uid) => !after.includes(uid))
  const auth = getAuth()

  await Promise.allSettled(
    added.map((uid) => auth.setCustomUserClaims(uid, { familyId, role: 'admin' })),
  )

  // Removal has to revoke as well as clear: a cleared claim still sits in the
  // ID token the removed admin is holding, which stays valid for up to an hour.
  await Promise.allSettled(
    removed.map(async (uid) => {
      const user = await auth.getUser(uid).catch(() => null)
      if (!user) return
      // Only clear a claim that points at *this* family, so an admin who moved
      // families does not lose the claim they were just given.
      if (user.customClaims?.familyId && user.customClaims.familyId !== familyId) return
      await auth.setCustomUserClaims(uid, null)
      await auth.revokeRefreshTokens(uid)
    }),
  )
})

// ── 3. Rate limiting ────────────────────────────────────────────────────────

const MAX_FAILURES = 5
const FAILURE_WINDOW_MS = 15 * 60 * 1000
const BASE_BLOCK_MS = 30 * 1000
const MAX_BLOCK_MS = 60 * 60 * 1000

/**
 * Throws when `key` is currently blocked. Call before doing any work — the
 * bcrypt comparison is deliberately expensive, so an attacker must not be able
 * to make us run it.
 */
async function assertNotBlocked(key) {
  const snap = await getFirestore().doc(`rateLimits/${key}`).get()
  const blockedUntil = snap.exists ? snap.data().blockedUntil : null
  if (blockedUntil && blockedUntil.toMillis() > Date.now()) {
    throw new HttpsError(
      'resource-exhausted',
      'Too many attempts. Please wait a moment and try again.',
    )
  }
}

async function recordFailure(key) {
  const ref = getFirestore().doc(`rateLimits/${key}`)
  await getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const now = Date.now()
    const data = snap.exists ? snap.data() : null
    const windowStart = data?.firstFailureAt?.toMillis?.() ?? now
    const withinWindow = now - windowStart < FAILURE_WINDOW_MS

    const failures = (withinWindow ? data?.failures ?? 0 : 0) + 1
    const over = failures - MAX_FAILURES
    const blockMs = over >= 0 ? Math.min(BASE_BLOCK_MS * 2 ** over, MAX_BLOCK_MS) : 0

    tx.set(ref, {
      failures,
      firstFailureAt: withinWindow && data?.firstFailureAt ? data.firstFailureAt : new Date(now),
      blockedUntil: blockMs > 0 ? new Date(now + blockMs) : null,
      updatedAt: new Date(now),
    })
  })
}

const clearFailures = (key) => getFirestore().doc(`rateLimits/${key}`).delete().catch(() => {})

/** Rate-limit keys must be a single path segment, so the id is sanitised. */
const safeKey = (prefix, value) => `${prefix}__${String(value).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 96)}`

// ── 4. Viewer login ─────────────────────────────────────────────────────────

/**
 * Check a family's shared password and mint a viewer token.
 *
 * Every failure answers the same way. "No such family" and "wrong password"
 * must not be distinguishable, or this endpoint becomes a way to enumerate
 * which families exist.
 */
export const viewerLogin = onCall({ enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  const familyId = String(request.data?.familyId || '')
  const password = String(request.data?.password || '')
  const generic = new HttpsError('permission-denied', 'Invalid password')

  if (!familyId || !password) throw generic

  const familyKey = safeKey('viewerLogin', familyId)
  const ipKey = safeKey('viewerLoginIp', request.rawRequest?.ip || 'unknown')

  await assertNotBlocked(familyKey)
  await assertNotBlocked(ipKey)

  const secretSnap = await getFirestore().doc(`families/${familyId}/secrets/auth`).get()
  const hash = secretSnap.exists ? secretSnap.data().sharedPassword : null

  if (!hash || !(await bcrypt.compare(password, hash))) {
    await Promise.all([recordFailure(familyKey), recordFailure(ipKey)])
    throw generic
  }

  await Promise.all([clearFailures(familyKey), clearFailures(ipKey)])

  // One viewer identity per family, because the password is per family too.
  // The payoff is revocation: changing the password revokes every viewer in a
  // single call. The cost is that a single device cannot be locked out alone.
  const token = await getAuth().createCustomToken(`viewer:${familyId}`, {
    familyId,
    role: 'viewer',
  })
  return { token }
})

// ── 5. Shared password ──────────────────────────────────────────────────────

/**
 * Set a family's shared password. Admin only, and the plaintext never lands in
 * Firestore — the hash is written to a subcollection no client can read.
 */
export const setSharedPassword = onCall({ enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first')

  const familyId = String(request.data?.familyId || '')
  const password = String(request.data?.password || '')
  if (!familyId) throw new HttpsError('invalid-argument', 'No family given')
  if (password.length < 4) throw new HttpsError('invalid-argument', 'Password is too short')

  const familySnap = await getFirestore().doc(`families/${familyId}`).get()
  // adminUids on the document, not the caller's claim: this is the source of
  // truth, and it is correct even before the claim trigger has caught up.
  if (!familySnap.exists || !adminUidsOf(familySnap.data()).includes(uid)) {
    throw new HttpsError('permission-denied', 'Not an admin of this family')
  }

  const hash = await bcrypt.hash(password, 10)
  await getFirestore().doc(`families/${familyId}/secrets/auth`).set({
    sharedPassword: hash,
    updatedAt: new Date(),
  })

  // Everyone who logged in with the old password loses their session. That is
  // the point of changing it.
  await getAuth().revokeRefreshTokens(`viewer:${familyId}`).catch(() => {})

  return { ok: true }
})
