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
      const user = await auth.getUser(uid).catch(() => null)
      if (!user) return
      // Only clear a claim that points at *this* family, so an admin who moved
      // families does not lose the claim they were just given.
      if (user.customClaims?.familyId && user.customClaims.familyId !== familyId) return
      await auth.setCustomUserClaims(uid, null)
      await auth.revokeRefreshTokens(uid)
    }),
  )
  // Every uid is tried before any failure is reported, so one account Firebase
  // Auth refuses does not hold up the others. Then it is thrown: the trigger
  // retries, and a removed admin whose claim could not be cleared is not left
  // with it.
  const failed = results.find((result) => result.status === 'rejected')
  if (failed) throw failed.reason
}
