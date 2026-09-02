#!/usr/bin/env node
/**
 * One-time migration for the access-control change.
 * See docs/plan-a-zugriffskontrolle.md.
 *
 * Three things, all idempotent — run it as often as you like:
 *
 *   1. familyPublic/{id}   the login page's fields, mirrored out of families/{id}
 *   2. secrets/auth        the shared-password hash, moved off the family document
 *   3. admin claims        { familyId, role: 'admin' } for every uid in adminUids
 *
 * Run it BEFORE deploying the new firestore.rules. Until the rules change, both
 * the old and the new shape work, so there is no window where the app is broken.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/migrate-access-control.mjs --dry-run
 *   ... then again without --dry-run
 *
 * The service-account key is a full-access credential. .gitignore covers
 * `service-account*.json` and `*-firebase-adminsdk-*.json`; if you name it
 * something else, add it there first. Delete it once the migration is done.
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

const DRY_RUN = process.argv.includes('--dry-run')

// Must match PUBLIC_FAMILY_FIELDS in functions/index.js. If these two ever
// disagree, the mirror trigger wins — it runs on every later write.
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

initializeApp({ credential: applicationDefault() })
const db = getFirestore()
const auth = getAuth()

const say = (...args) => console.log(DRY_RUN ? '[dry-run]' : '[migrate]', ...args)

function adminUidsOf(data) {
  const list = Array.isArray(data.adminUids) ? data.adminUids : []
  if (list.length > 0) return list
  return data.adminUid ? [data.adminUid] : []
}

async function main() {
  const families = await db.collection('families').get()
  say(`${families.size} families`)

  const counts = { mirrored: 0, passwordsMoved: 0, claimsSet: 0, claimsSkipped: 0, errors: 0 }

  for (const familyDoc of families.docs) {
    const familyId = familyDoc.id
    const data = familyDoc.data()

    // ── 1. Public mirror ────────────────────────────────────────────────
    const mirror = {}
    for (const field of PUBLIC_FAMILY_FIELDS) {
      if (data[field] !== undefined) mirror[field] = data[field]
    }
    if (!DRY_RUN) await db.doc(`familyPublic/${familyId}`).set(mirror)
    counts.mirrored++
    say(`${familyId}: mirrored ${Object.keys(mirror).length} public fields`)

    // ── 2. Shared password ──────────────────────────────────────────────
    // Moved, not copied: leaving it on the family document would keep it
    // readable by every member, which is not what a password hash is for.
    if (data.sharedPassword) {
      if (!DRY_RUN) {
        await db.doc(`families/${familyId}/secrets/auth`).set({
          sharedPassword: data.sharedPassword,
          migratedAt: new Date(),
        })
        await familyDoc.ref.update({ sharedPassword: FieldValue.delete() })
      }
      counts.passwordsMoved++
      say(`${familyId}: shared password moved to secrets/auth`)
    }

    // ── 3. Admin claims ─────────────────────────────────────────────────
    for (const uid of adminUidsOf(data)) {
      try {
        const user = await auth.getUser(uid)
        if (user.customClaims?.familyId === familyId && user.customClaims?.role === 'admin') {
          counts.claimsSkipped++
          continue
        }
        if (!DRY_RUN) await auth.setCustomUserClaims(uid, { familyId, role: 'admin' })
        counts.claimsSet++
        say(`${familyId}: claim set for ${uid}`)
      } catch (err) {
        // An account that no longer exists is not a reason to stop: the family
        // document simply still lists a uid Firebase Auth has forgotten.
        counts.errors++
        say(`${familyId}: could not set claim for ${uid} — ${err.message}`)
      }
    }
  }

  // ── 4. Audit ────────────────────────────────────────────────────────
  // The new read rules test `resource.data.familyId`, and a rule that reads a
  // missing field denies. Any document without one becomes unreadable — safe,
  // but silent, so say so here rather than letting someone find out from an
  // empty feed. Everything written through the app has the field; this catches
  // anything older than the rule that started requiring it.
  const orphans = []
  for (const name of ['memories', 'moments', 'albums']) {
    const snap = await db.collection(name).get()
    const missing = snap.docs.filter((d) => typeof d.data().familyId !== 'string')
    if (missing.length > 0) orphans.push(`${name}: ${missing.length} of ${snap.size}`)
  }
  if (orphans.length > 0) {
    say('documents with no familyId — these will NOT be readable after the rules deploy:')
    for (const line of orphans) say(`  ${line}`)
  } else {
    say('every memory, moment and album carries a familyId')
  }

  console.log('\nDone.', counts)
  if (DRY_RUN) console.log('Nothing was written. Re-run without --dry-run to apply.')
  else console.log('Admins must refresh their ID token (a reload does it) to pick up the claim.')
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
