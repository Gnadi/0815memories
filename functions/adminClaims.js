/**
 * The admin claim, `{ familyId, role: 'admin' }`, kept in step with a family's
 * `adminUids` — the logic of the syncAdminClaims trigger in index.js.
 *
 * The event says who to look at, the family document as it stands says what
 * they are. Taking the verdict from the event's own before/after was wrong:
 * Firestore triggers are not delivered in order and are retried, so an
 * "added" processed after a later "removed" gave a removed admin their claim
 * back, for good. Reading the document when the trigger runs makes every
 * delivery, early, late or repeated, end in the current state.
 */

/** The admins of a family document. */
export function adminUidsOf(data) {
  return Array.isArray(data?.adminUids) ? data.adminUids : []
}

/**
 * @param {object} deps
 * @param {import('firebase-admin/firestore').Firestore} deps.db
 * @param {import('firebase-admin/auth').Auth} deps.auth
 * @param {string} familyId
 * @param {{ before: object|null, after: object|null }} change  the event's documents
 */
export async function reconcileAdminClaims({ db, auth }, familyId, { before, after }) {
  const previous = adminUidsOf(before)
  const next = adminUidsOf(after)
  const touched = [
    ...next.filter((uid) => !previous.includes(uid)),
    ...previous.filter((uid) => !next.includes(uid)),
  ]
  if (touched.length === 0) return { granted: [], cleared: [] }

  const snap = await db.doc(`families/${familyId}`).get()
  const current = adminUidsOf(snap.exists ? snap.data() : null)

  const granted = []
  const cleared = []
  await Promise.allSettled(
    touched.map(async (uid) => {
      if (current.includes(uid)) {
        await auth.setCustomUserClaims(uid, { familyId, role: 'admin' })
        granted.push(uid)
        return
      }
      const user = await auth.getUser(uid).catch(() => null)
      if (!user) return
      // Only clear a claim that points at *this* family, so an admin who moved
      // families does not lose the claim they were just given.
      if (user.customClaims?.familyId && user.customClaims.familyId !== familyId) return
      // Revoking as well as clearing: a cleared claim still sits in the ID
      // token the removed admin is holding, which stays valid for up to an hour.
      await auth.setCustomUserClaims(uid, null)
      await auth.revokeRefreshTokens(uid)
      cleared.push(uid)
    }),
  )
  return { granted, cleared }
}
