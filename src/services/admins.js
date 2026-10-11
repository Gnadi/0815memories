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
  getDocs,
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

/** A new invite from `createdBy`; returns its token, which the link carries. */
export async function createInvite(familyId, createdBy) {
  const token = generateInviteToken()
  await setDoc(inviteRef(familyId, token), {
    createdBy,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + INVITE_TTL_MS),
    used: false,
    redeemedBy: null,
    redeemedAt: null,
  })
  return token
}

/** The open invites `uid` minted, by token: what removing them has to revoke. */
export async function openInvitesBy(familyId, uid) {
  const snapshot = await getDocs(query(
    collection(db, FAMILIES, familyId, 'invites'), where('createdBy', '==', uid), where('used', '==', false),
  ))
  return snapshot.docs.map((d) => d.id)
}

export async function revokeInvite(familyId, token) {
  await deleteDoc(inviteRef(familyId, token))
}

/**
 * Removes an admin. The invites they minted go first: the link is the
 * credential, and they still hold it — left pending, any one of them lets
 * them straight back in. Then the two writes the rules check one by one: the
 * owner always stays in adminUids, and only an admin may change it.
 */
export async function removeAdmin(familyId, uid, theirInviteIds = []) {
  await Promise.all(theirInviteIds.map((token) => revokeInvite(familyId, token)))
  await deleteDoc(adminRef(familyId, uid))
  await updateDoc(doc(db, FAMILIES, familyId), { adminUids: arrayRemove(uid) })
}
