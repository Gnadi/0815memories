/**
 * Firebase Cloud Functions — Kaydo
 *
 * Push notifications (this file's first half) and access control (the second).
 * Everything runs in europe-west3, set once at the top: setGlobalOptions only
 * reaches v2 functions, and only those defined after the call.
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

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { setGlobalOptions } from 'firebase-functions/v2'
import { getAuth } from 'firebase-admin/auth'
import bcrypt from 'bcryptjs'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { anniversaryWindow, countAnniversaryMemories } from './anniversary.js'
import { publicSlugFor, releaseFamilySlug } from './slugs.js'
import { checkViewerLogin } from './viewerLogin.js'
import {
  COPY,
  MULTICAST_CHUNK,
  anniversaryCopy,
  chunk,
  groupTokensByLang,
  isDeadToken,
} from './push.js'

// Before every function definition below — a v2 function keeps whatever region
// was in force when it was defined, so a call further down would silently
// leave the ones above it in us-central1.
setGlobalOptions({ region: 'europe-west3', maxInstances: 10 })

// No credentials arg — Firebase injects them automatically in the Cloud Functions runtime
initializeApp()

// ---------------------------------------------------------------------------
// Shared by both halves of this file
// ---------------------------------------------------------------------------

// App Check keeps anonymous scripts off the callable endpoints. It needs a
// reCAPTCHA key wired into the client first, so it is opt-in via env until
// that is configured — see the follow-up section of the plan. The rate limiter
// further down does not depend on it.
const ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === 'true'

// Mirrored by SettingsPanel, which says so before the round trip.
const MIN_SHARED_PASSWORD_LENGTH = 8

/** The admins of a family document, across both the legacy and current shape. */
function adminUidsOf(data) {
  if (!data) return []
  const list = Array.isArray(data.adminUids) ? data.adminUids : []
  if (list.length > 0) return list
  return data.adminUid ? [data.adminUid] : []
}

// ---------------------------------------------------------------------------
// Push notifications
//
// The text is composed here rather than by the client. Two reasons: memory
// titles and moment captions are encrypted, so putting one in a push payload
// would hand Google the plaintext the rest of the app goes to some length to
// withhold; and a client-supplied payload is a broadcast channel whose content
// nothing validates.
//
// The trade is that the server has to know the language. Each device records
// its own in its fcmTokens document, and the tokens are grouped by it below.
// ---------------------------------------------------------------------------

const ANNIVERSARY_TIMEZONE = 'Europe/Berlin'

/**
 * Send one notification to every device registered for a family.
 *
 * @param {string} familyId
 * @param {(lang: 'de'|'en') => {title: string, body: string, url: string}} build
 * @param {{ excludeUid?: string|null }} [options]
 * @returns {Promise<{ devices: number, sent: number, failed: number }>}
 */
async function sendToFamily(familyId, build, { excludeUid = null } = {}) {
  const stats = { devices: 0, sent: 0, failed: 0 }
  if (!familyId) return stats

  const snapshot = await getFirestore()
    .collection('fcmTokens')
    .where('familyId', '==', familyId)
    .get()

  const byLang = groupTokensByLang(snapshot.docs, { excludeUid })
  if (byLang.size === 0) return stats

  const messaging = getMessaging()

  for (const [lang, group] of byLang) {
    const { title, body, url } = build(lang)
    stats.devices += group.length

    for (const batch of chunk(group, MULTICAST_CHUNK)) {
      // Data-only: src/sw.js owns the notification's appearance, and a
      // `notification` block would have the browser draw its own on top.
      const response = await messaging.sendEachForMulticast({
        tokens: batch.map((d) => d.data().token),
        data: { title, body: body || '', url: url || '/' },
        webpush: { headers: { TTL: '86400', Urgency: 'normal' } },
      })

      stats.sent += response.successCount
      stats.failed += response.failureCount

      await Promise.allSettled(
        response.responses.map((r, i) =>
          r.success || !isDeadToken(r.error?.code) ? null : batch[i].ref.delete(),
        ),
      )
    }
  }

  console.log(
    `[push] family=${familyId} sent=${stats.sent} failed=${stats.failed} devices=${stats.devices}`,
  )
  return stats
}

// ── New memory / new moment ─────────────────────────────────────────────────

export const notifyOnMemory = onDocumentCreated('memories/{memoryId}', (event) => {
  const data = event.data?.data()
  if (!data?.familyId) return
  return sendToFamily(
    data.familyId,
    (lang) => ({ ...COPY.memory[lang], url: `/memory/${event.params.memoryId}` }),
    { excludeUid: data.createdByUid },
  )
})

export const notifyOnMoment = onDocumentCreated('moments/{momentId}', (event) => {
  const data = event.data?.data()
  if (!data?.familyId) return
  return sendToFamily(data.familyId, (lang) => ({ ...COPY.moment[lang], url: '/' }), {
    excludeUid: data.createdByUid,
  })
})

// ── "Three years ago today" ─────────────────────────────────────────────────

/**
 * Replaces the client-side daily check, which only ran when an admin happened
 * to open the app and needed a lock on the family document to keep two devices
 * from sending it twice.
 */
export const dailyAnniversaryCheck = onSchedule(
  // One query, then one send per family that has something to remember. The
  // sends are the part that grows, so the default 60s stays too tight.
  { schedule: '0 8 * * *', timeZone: ANNIVERSARY_TIMEZONE, timeoutSeconds: 300 },
  async () => {
    const window = anniversaryWindow(new Date(), ANNIVERSARY_TIMEZONE)
    const counts = await countAnniversaryMemories(getFirestore(), window)

    for (const [familyId, count] of counts) {
      await sendToFamily(familyId, (lang) => ({
        ...anniversaryCopy(lang, count, window.year),
        url: '/timeline?filter=onthisday',
      }))
    }

    console.log(`[anniversary] year=${window.year} notified=${counts.size}`)
  },
)

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

// ── 1. Public mirror ────────────────────────────────────────────────────────

export const mirrorFamilyPublic = onDocumentWritten('families/{familyId}', async (event) => {
  const { familyId } = event.params
  const db = getFirestore()
  const before = event.data?.before?.exists ? event.data.before.data() : null
  const after = event.data?.after
  const publicRef = db.doc(`familyPublic/${familyId}`)

  if (!after?.exists) {
    await publicRef.delete().catch(() => {})
    await releaseFamilySlug(db, familyId, before?.familySlug).catch(() => {})
    return
  }

  const data = after.data() || {}
  const mirror = {}
  for (const field of PUBLIC_FAMILY_FIELDS) {
    if (data[field] !== undefined) mirror[field] = data[field]
  }

  // The address is the one public field that has to be unique, and the family
  // document cannot promise that — any signed-in client can write any slug to
  // it. So the mirror carries only a slug this family holds in the registry.
  const slug = await publicSlugFor(db, familyId, data.familySlug, before?.familySlug)
  if (slug) mirror.familySlug = slug
  else delete mirror.familySlug

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

// ── 3. Viewer login ─────────────────────────────────────────────────────────

/**
 * Check a family's shared password and mint a viewer token. The checking and
 * the throttling live in viewerLogin.js; this is the wiring.
 *
 * Every failure answers the same way. "No such family" and "wrong password"
 * must not be distinguishable, or this endpoint becomes a way to enumerate
 * which families exist.
 *
 * `rawRequest.ip` is only a hint: the functions framework trusts
 * X-Forwarded-For, so the caller chooses it. The limits that hold are the
 * family's (for devices that have never signed in) and the device's own.
 */
export const viewerLogin = onCall({ enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  const result = await checkViewerLogin(
    {
      db: getFirestore(),
      compare: (password, hash) => bcrypt.compare(password, hash),
      // One viewer identity per family, because the password is per family
      // too. The payoff is revocation: changing the password revokes every
      // viewer in a single call. The cost is that a single device cannot be
      // locked out alone.
      mintToken: (familyId) =>
        getAuth().createCustomToken(`viewer:${familyId}`, { familyId, role: 'viewer' }),
    },
    {
      familyId: request.data?.familyId,
      password: request.data?.password,
      deviceToken: request.data?.deviceToken,
      ip: request.rawRequest?.ip,
    },
  )

  if (result.outcome === 'blocked') {
    throw new HttpsError('resource-exhausted', 'Too many attempts. Please wait a moment and try again.')
  }
  if (result.outcome !== 'ok') throw new HttpsError('permission-denied', 'Invalid password')
  return result.deviceToken ? { token: result.token, deviceToken: result.deviceToken } : { token: result.token }
})

// ── 4. Shared password ──────────────────────────────────────────────────────

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
  // It is what stands between a guesser and the family's encryption key, and
  // guessing is throttled, not stopped. Existing passwords keep working.
  if (password.length < MIN_SHARED_PASSWORD_LENGTH) {
    throw new HttpsError('invalid-argument', 'Password is too short')
  }

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
