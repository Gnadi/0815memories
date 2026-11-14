/**
 * Redeeming an invite: what the invite page does, before and as the invitee's
 * account is made. Creating and revoking invites is the admins' side
 * (services/admins.js); this module is kept apart from it because the invite
 * page is part of the startup bundle.
 */
import { doc, getDoc } from '../config/firestore'
import { db } from '../config/firebase'
import { callFunction } from './callable'

const FAMILIES = 'families'

const inviteRef = (familyId, token) => doc(db, FAMILIES, familyId, 'invites', token)

/** The invite behind a link, or null. Read before the invitee has an account. */
export async function getInvite(familyId, token) {
  const snap = await getDoc(inviteRef(familyId, token))
  return snap.exists() ? snap.data() : null
}

/**
 * Redeems an invite for the signed-in account, which becomes an admin of the
 * family. The redeemFamilyInvite function does it in one transaction
 * (functions/membership.js): it consumes the invite, lists the new admin and
 * adds them to `adminUids`, and takes who is asking from their ID token. The
 * browser used to make those three writes itself; the rules now refuse them.
 */
export async function redeemInvite(familyId, token) {
  await callFunction('redeemFamilyInvite', { familyId, token })
}
