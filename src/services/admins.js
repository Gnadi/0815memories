/**
 * The family's admins, and the invite links that make new ones.
 *
 * Who is an admin is `adminUids` on the family document, which the rules read;
 * `families/{id}/admins/{uid}` only holds what the settings show about each of
 * them. An invite is a document named after its token — the link is the
 * credential — good for one redemption within INVITE_TTL_MS. Redeeming one is
 * in services/invites.js: the invite page is part of the startup bundle, and
 * what the admins do here is not. Who is an admin changes only through the
 * functions of functions/membership.js; this module mints and revokes links.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from '../config/firestore'
import { db } from '../config/firebase'
import { callFunction } from './callable'
import { generateInviteToken, INVITE_TTL_MS } from '../utils/inviteToken'

const FAMILIES = 'families'

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
 * Removes an admin. The removeFamilyAdmin function does it in one transaction
 * (functions/membership.js): the admin leaves `adminUids`, their entry here
 * goes, and so does every pending invite — not only the ones they minted,
 * since all admins can list and copy all pending links. It also raises the
 * family's invite epoch, which retires a link made in that very moment.
 */
export async function removeAdmin(familyId, uid) {
  await callFunction('removeFamilyAdmin', { familyId, uid })
}
