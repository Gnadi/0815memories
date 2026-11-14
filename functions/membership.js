/**
 * Who is an admin of a family: joining with an invite, and being removed.
 *
 * Both used to be written by the browser and judged by firestore.rules, one
 * write at a time: redeeming was a batch of three writes whose rules each had
 * to insist on the other two, and removing was three separate writes. The
 * rules for that were the hardest in the file to get right, and the ones that
 * kept needing repairs: a spent invite replayed by a removed admin, a link
 * that survived the removal of whoever held it. Here each is one transaction
 * that reads the family, decides, and writes everything or nothing, and the
 * rules simply refuse a client any change to `adminUids`.
 *
 * `adminUids` on the family document stays what decides (firestore.rules reads
 * it on every request), and syncAdminClaims follows it with the token claim.
 *
 * Nothing here imports firebase-admin or firebase-functions: Firestore and the
 * clock come in as arguments, so the tests can stub them.
 */

const FAMILY_ID = /^[A-Za-z0-9_-]{1,100}$/
// An invite's document id: 32 random bytes, base64url (src/utils/inviteToken.js).
// Checked because it becomes part of a document path.
const INVITE_TOKEN = /^[A-Za-z0-9_-]{1,200}$/
// Firebase Auth uids, and the room its custom ones have.
const UID = /^[A-Za-z0-9:_-]{1,128}$/

export class MembershipError extends Error {
  /** @param {'unauthenticated'|'invalid-argument'|'permission-denied'|'failed-precondition'} code */
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

const adminUidsOf = (data) => (Array.isArray(data?.adminUids) ? data.adminUids : [])

const millis = (value) => {
  if (value == null) return NaN
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return Number(value)
}

const familyIdOf = (data) => {
  const familyId = typeof data?.familyId === 'string' ? data.familyId : ''
  if (!FAMILY_ID.test(familyId)) throw new MembershipError('invalid-argument', 'No family given')
  return familyId
}

// One answer for every invite that cannot be used — unknown, spent, expired,
// retired by a removal — so the function does not say which links exist.
const invalidInvite = () => new MembershipError('failed-precondition', 'This invite can no longer be used')

/**
 * Make the caller an admin of the family their invite is for.
 *
 * The invite is consumed in the same transaction that adds them, so it cannot
 * be used twice, by two people at once or by one person again. It has to be of
 * the family's current invite epoch, which every removal raises: a link a
 * removed admin kept is dead.
 *
 * The caller's address has to be confirmed. A password reset goes to it, so an
 * account with an unconfirmed address belongs to whoever reads that mailbox,
 * and the family's key would go with it.
 *
 * @param {{ db: any, now?: () => number }} deps
 * @param {{ uid?: string, email?: string, emailVerified?: boolean, role?: string }} caller  from the verified ID token
 * @param {{ familyId?: unknown, token?: unknown }} data
 */
export async function redeemInvite({ db, now = Date.now }, caller, data) {
  const uid = caller?.uid
  if (!uid) throw new MembershipError('unauthenticated', 'Sign in first')
  // A viewer's identity is the family's shared one; it must never become an admin.
  if (caller.role === 'viewer') throw new MembershipError('permission-denied', 'Sign in with your own account')
  if (caller.emailVerified !== true) throw new MembershipError('permission-denied', 'Confirm your email address first')

  const familyId = familyIdOf(data)
  const token = typeof data?.token === 'string' ? data.token : ''
  if (!INVITE_TOKEN.test(token)) throw invalidInvite()

  const familyRef = db.doc(`families/${familyId}`)
  const inviteRef = db.doc(`families/${familyId}/invites/${token}`)
  const adminRef = db.doc(`families/${familyId}/admins/${uid}`)

  return db.runTransaction(async (tx) => {
    const [familySnap, inviteSnap] = await Promise.all([tx.get(familyRef), tx.get(inviteRef)])
    if (!familySnap.exists || !inviteSnap.exists) throw invalidInvite()
    const family = familySnap.data()
    const invite = inviteSnap.data()
    const at = now()

    if (invite.used !== false) throw invalidInvite()
    if (!(millis(invite.expiresAt) > at)) throw invalidInvite()
    // A family that has never removed an admin has no epoch, and an invite
    // from before the field existed has none either: both read as 0.
    if ((invite.epoch ?? 0) !== (family.inviteEpoch ?? 0)) throw invalidInvite()
    const admins = adminUidsOf(family)
    // Already in: nothing to join, and the invite is left for whom it was meant.
    if (admins.includes(uid)) throw invalidInvite()

    const when = new Date(at)
    tx.update(inviteRef, { used: true, redeemedBy: uid, redeemedAt: when })
    // What the settings show about this admin. The address is the token's,
    // not one the browser sent.
    tx.set(adminRef, {
      email: typeof caller.email === 'string' ? caller.email.trim().toLowerCase() : '',
      viaInvite: token,
      addedAt: when,
    })
    tx.update(familyRef, { adminUids: [...admins, uid] })
    return { ok: true }
  })
}

/**
 * Remove an admin from a family. Any admin may remove another, or leave; the
 * owner cannot be removed and cannot leave, so a family always has one.
 *
 * Every pending invite goes with them, not only the ones they made: all
 * admins can list and copy all pending links, so the removed admin may hold
 * any of them. The epoch is raised as well, which retires a link this
 * transaction did not see.
 *
 * @param {{ db: any }} deps
 * @param {string|undefined} uid  the caller, from the verified ID token
 * @param {{ familyId?: unknown, uid?: unknown }} data  `uid` is the admin to remove
 */
export async function removeAdmin({ db }, uid, data) {
  if (!uid) throw new MembershipError('unauthenticated', 'Sign in first')
  const familyId = familyIdOf(data)
  const target = typeof data?.uid === 'string' ? data.uid : ''
  if (!UID.test(target)) throw new MembershipError('invalid-argument', 'No admin given')

  const familyRef = db.doc(`families/${familyId}`)
  const invites = db.collection(`families/${familyId}/invites`)

  return db.runTransaction(async (tx) => {
    const familySnap = await tx.get(familyRef)
    const family = familySnap.exists ? familySnap.data() : null
    const admins = adminUidsOf(family)
    // The document, not the caller's claim: a removed admin keeps the claim in
    // the token they hold for up to an hour.
    if (!admins.includes(uid)) throw new MembershipError('permission-denied', 'Not an admin of this family')
    if (target === family.adminUid) throw new MembershipError('failed-precondition', 'The owner cannot be removed')
    if (!admins.includes(target)) throw new MembershipError('failed-precondition', 'Not an admin of this family')

    const pending = await tx.get(invites.where('used', '==', false))
    for (const invite of pending.docs) tx.delete(invite.ref)
    tx.delete(db.doc(`families/${familyId}/admins/${target}`))
    tx.update(familyRef, {
      adminUids: admins.filter((admin) => admin !== target),
      inviteEpoch: (family.inviteEpoch ?? 0) + 1,
    })
    return { ok: true }
  })
}
