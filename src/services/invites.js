/**
 * Redeeming an invite: what the invite page does, before and as the invitee's
 * account is made. Creating and revoking invites is the admins' side
 * (services/admins.js); this module is kept apart from it because the invite
 * page is part of the startup bundle.
 */
import { arrayUnion, doc, getDoc, serverTimestamp, writeBatch } from '../config/firestore'
import { db } from '../config/firebase'

const FAMILIES = 'families'

const adminRef = (familyId, uid) => doc(db, FAMILIES, familyId, 'admins', uid)
const inviteRef = (familyId, token) => doc(db, FAMILIES, familyId, 'invites', token)

/** The invite behind a link, or null. Read before the invitee has an account. */
export async function getInvite(familyId, token) {
  const snap = await getDoc(inviteRef(familyId, token))
  return snap.exists() ? snap.data() : null
}

/**
 * Redeems an invite for the account just created for `uid`: consume the
 * invite, create admins/{uid} with the invite as proof, and join the family's
 * adminUids. The rules accept each of these only together with the other two.
 * As three separate writes, the spent invite stayed behind as proof that a
 * removed admin could replay to let themselves back in.
 */
export async function redeemInvite(familyId, token, { uid, email }) {
  const batch = writeBatch(db)
  batch.update(inviteRef(familyId, token), {
    used: true,
    redeemedBy: uid,
    redeemedAt: serverTimestamp(),
  })
  batch.set(adminRef(familyId, uid), {
    email,
    viaInvite: token,
    addedAt: serverTimestamp(),
  })
  batch.update(doc(db, FAMILIES, familyId), { adminUids: arrayUnion(uid) })
  await batch.commit()
}
