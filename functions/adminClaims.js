/**
 * Keeping the `familyId` / `role: 'admin'` custom claim in step with a family's
 * `adminUids`. Wired to the Firestore trigger in index.js; kept here so it can
 * be tested with fake `db` and `auth` objects.
 */

/** The admins of a family document. */
export function adminUidsOf(data) {
  return Array.isArray(data?.adminUids) ? data.adminUids : []
}

/**
 * `before` and `after` are the family document's data from the trigger event
 * (null when it did not exist).
 *
 * Firestore triggers are not delivered in order, so a late "uid added" event
 * can arrive after the "uid removed" one. Acting on the event alone would then
 * re-grant admin to someone who was removed. The event therefore only says
 * which uids to look at; the current document decides what their claim is.
 */
export async function syncClaimsForFamily({ db, auth }, { familyId, before, after }) {
  const was = adminUidsOf(before)
  const is = adminUidsOf(after)
  const changed = [
    ...is.filter((uid) => !was.includes(uid)),
    ...was.filter((uid) => !is.includes(uid)),
  ]
  if (changed.length === 0) return

  const snap = await db.doc(`families/${familyId}`).get()
  const current = snap.exists ? adminUidsOf(snap.data()) : []

  const results = await Promise.allSettled(
    changed.map(async (uid) => {
      if (current.includes(uid)) {
        await auth.setCustomUserClaims(uid, { familyId, role: 'admin' })
        return
      }
      // Removal has to revoke as well as clear: a cleared claim still sits in
      // the ID token the removed admin is holding, which stays valid for up to
      // an hour.
      const user = await auth.getUser(uid).catch((error) => {
        if (isUserNotFound(error)) return null
        throw error
      })
      if (!user) return
      // Only clear a claim that points at *this* family, so an admin who moved
      // families does not lose the claim they were just given.
      if (user.customClaims?.familyId && user.customClaims.familyId !== familyId) return
      await auth.setCustomUserClaims(uid, null)
      await auth.revokeRefreshTokens(uid)
    }),
  )

  // A swallowed failure would end the invocation as a success and the claim
  // would stay stale, so every failure is logged and the invocation is failed
  // once all uids have been tried.
  const failures = []
  results.forEach((result, i) => {
    if (result.status === 'fulfilled' || isUserNotFound(result.reason)) return
    failures.push(changed[i])
    logFailure(changed[i], result.reason)
  })
  if (failures.length > 0) {
    throw new Error(`Could not sync admin claims for ${failures.length} user(s) of a family`)
  }
}

/** True when Firebase Auth reports that the user does not exist (any more). */
function isUserNotFound(error) {
  return error?.code === 'auth/user-not-found'
}

// Only the uid and the error's code or message: never tokens or family content.
function logFailure(uid, error) {
  console.error('Admin claim sync failed', { uid, error: error?.code || error?.message || 'unknown' })
}

const isExactAdminClaim = (claims, familyId) =>
  claims?.role === 'admin' && claims.familyId === familyId && Object.keys(claims).length === 2

/**
 * Nightly repair for what the trigger can miss: an event that failed for good,
 * or one that never arrived. Walks every family and every Auth user, and makes
 * the claims match the family documents again, in both directions.
 *
 * Viewers (uid `viewer:...`, role `viewer`) and users without claims are never
 * touched. A uid that is admin of two families keeps a claim that points at a
 * family that still lists them, so the pass does not flip it back and forth.
 *
 * One failing user does not stop the pass; it is counted, and the function
 * throws at the end so the failure shows up in the logs and the scheduler.
 */
export async function reconcileAdminClaims({ db, auth }) {
  const stats = { families: 0, granted: 0, cleared: 0, failed: 0 }
  const adminsByFamily = new Map()
  const snapshot = await db.collection('families').get()
  snapshot.forEach((doc) => adminsByFamily.set(doc.id, adminUidsOf(doc.data())))
  stats.families = adminsByFamily.size

  // The list above is read once, and a pass takes a while. Before a claim is
  // written, the one family it concerns is read again, so that someone who
  // joined or was removed during the pass is judged by where they stand now —
  // clearing on the old list would sign out an admin who has just joined.
  const isAdminNow = async (familyId, uid) => {
    const snap = await db.doc(`families/${familyId}`).get()
    return snap.exists && adminUidsOf(snap.data()).includes(uid)
  }

  const attempt = async (uid, work) => {
    try {
      await work()
    } catch (error) {
      if (isUserNotFound(error)) return
      stats.failed += 1
      logFailure(uid, error)
    }
  }

  for (const [familyId, adminUids] of adminsByFamily) {
    for (const uid of adminUids) {
      await attempt(uid, async () => {
        const { customClaims } = await auth.getUser(uid)
        if (isExactAdminClaim(customClaims, familyId)) return
        const otherFamily = customClaims?.role === 'admin' ? customClaims.familyId : null
        if (otherFamily && otherFamily !== familyId && adminsByFamily.get(otherFamily)?.includes(uid)) return
        if (!(await isAdminNow(familyId, uid))) return
        await auth.setCustomUserClaims(uid, { familyId, role: 'admin' })
        stats.granted += 1
      })
    }
  }

  let pageToken
  do {
    const page = await auth.listUsers(1000, pageToken)
    for (const user of page.users) {
      const claims = user.customClaims
      if (user.uid.startsWith('viewer:') || claims?.role !== 'admin' || !claims.familyId) continue
      if (adminsByFamily.get(claims.familyId)?.includes(user.uid)) continue
      await attempt(user.uid, async () => {
        if (await isAdminNow(claims.familyId, user.uid)) return
        await auth.setCustomUserClaims(user.uid, null)
        await auth.revokeRefreshTokens(user.uid)
        stats.cleared += 1
      })
    }
    pageToken = page.pageToken
  } while (pageToken)

  console.log('Admin claims reconciled', stats)
  if (stats.failed > 0) {
    throw new Error(`Admin claim reconciliation failed for ${stats.failed} user(s)`)
  }
  return stats
}
