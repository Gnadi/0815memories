/**
 * The family's admins, and the invite links that make new ones.
 *
 * Who is an admin is `adminUids` on the family document, which the rules read;
 * `families/{id}/admins/{uid}` only holds what the settings show about each of
 * them. An invite is a document named after its token — the link is the
 * credential — good for one redemption within INVITE_TTL_MS. Redeeming one is
 * in services/invites.js: the invite page is part of the startup bundle, and
 * what the admins do here is not.
 */
import {
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from '../config/firestore'
import { db } from '../config/firebase'
import { generateInviteToken, INVITE_TTL_MS } from '../utils/inviteToken'

const FAMILIES = 'families'

const adminRef = (familyId, uid) => doc(db, FAMILIES, familyId, 'admins', uid)
const inviteRef = (familyId, token) => doc(db, FAMILIES, familyId, 'invites', token)

/** The family's admins as `{ uid, ...entry }`, live. */
export function subscribeAdmins(familyId, onData, onError) {
  return onSnapshot(
    collection(db, FAMILIES, familyId, 'admins'),
    (snapshot) => onData(snapshot.docs.map((d) => ({ uid: d.id, ...d.data() }))),
    onError,
  )
}

/** Invites not redeemed and not expired, the newest first, live. */
export function subscribeOpenInvites(familyId, onData, onError) {
  return onSnapshot(
    query(collection(db, FAMILIES, familyId, 'invites'), where('used', '==', false)),
    (snapshot) => {
      const now = Date.now()
      const open = snapshot.docs
        .map((d) => {
          const data = d.data()
          return { id: d.id, ...data, expiresAtMs: data.expiresAt?.toMillis?.() ?? 0 }
        })
        .filter((invite) => invite.expiresAtMs > now)
      open.sort((a, b) => b.expiresAtMs - a.expiresAtMs)
      onData(open)
    },
    onError,
  )
}

/**
 * A new invite from `createdBy`; returns its token, which the link carries.
 *
 * It is stamped with the family's invite epoch, which every admin removal
 * raises (see removeAdmin). The rules accept a redemption only while the
 * invite's epoch is the family's current one.
 */
export async function createInvite(familyId, createdBy) {
  const token = generateInviteToken()
  const family = await getDoc(doc(db, FAMILIES, familyId))
  await setDoc(inviteRef(familyId, token), {
    createdBy,
    epoch: family.data()?.inviteEpoch ?? 0,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + INVITE_TTL_MS),
    used: false,
    redeemedBy: null,
    redeemedAt: null,
  })
  return token
}

export async function revokeInvite(familyId, token) {
  await deleteDoc(inviteRef(familyId, token))
}

/**
 * Removes an admin. Every pending invite goes first, not only the ones they
 * minted: all admins can list and copy all pending links, so the removed admin
 * may hold any of them, and a link that is left pending lets them straight
 * back in. Then the two writes the rules check one by one: the owner always
 * stays in adminUids, and only an admin may change it.
 *
 * The family update also raises `inviteEpoch` in the same write. That is the
 * backstop for a link this call did not delete, such as one created
 * concurrently: the rules refuse to redeem an invite from an earlier epoch.
 */
export async function removeAdmin(familyId, uid, pendingInviteIds = []) {
  await Promise.all(pendingInviteIds.map((token) => revokeInvite(familyId, token)))
  await deleteDoc(adminRef(familyId, uid))
  await updateDoc(doc(db, FAMILIES, familyId), {
    adminUids: arrayRemove(uid),
    inviteEpoch: increment(1),
  })
}
