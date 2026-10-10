/**
 * The family document, and the public face the login page reads.
 *
 * `families/{id}` holds what the family shares rather than what it remembers:
 * its name and address, its admins, its login page's design, and the key
 * everything else is encrypted with — written once, at signup
 * (firestore.rules). None of it is encrypted itself. Only the family can read
 * it; the login page, before anyone has signed in, reads `familyPublic/{id}`,
 * which the mirrorFamilyPublic function copies from a fixed allowlist.
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from '../config/firestore'
import { db } from '../config/firebase'

const FAMILIES = 'families'
const FAMILY_PUBLIC = 'familyPublic'

/**
 * The family document, live: `onData` gets its fields — encryption key
 * included, undecoded — or null while it does not exist.
 */
export function subscribeFamily(familyId, onData, onError) {
  return onSnapshot(
    doc(db, FAMILIES, familyId),
    (snap) => onData(snap.exists() ? snap.data() : null),
    onError,
  )
}

/** The family document's fields, or null. */
export async function getFamily(familyId) {
  const snap = await getDoc(doc(db, FAMILIES, familyId))
  return snap.exists() ? snap.data() : null
}

/** Merges `fields` into the family document: its name, address, card style, login page. */
export async function updateFamily(familyId, fields) {
  await setDoc(doc(db, FAMILIES, familyId), fields, { merge: true })
}

/** A new family, with its key: the rules refuse one without (hasEncryptionKey). */
export async function createFamily({ uid, name, slug, encryptionKeyJwk }) {
  const ref = await addDoc(collection(db, FAMILIES), {
    adminUid: uid,
    adminUids: [uid],
    familyName: name,
    familySlug: slug,
    encryptionKeyJwk,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * The families `uid` is an admin of, as `{ id, data }`. The oldest families
 * predate `adminUids` and name their single owner in `adminUid` instead.
 */
export async function findAdminFamilies(uid) {
  let snapshot = await getDocs(query(collection(db, FAMILIES), where('adminUids', 'array-contains', uid)))
  if (snapshot.empty) {
    snapshot = await getDocs(query(collection(db, FAMILIES), where('adminUid', '==', uid)))
  }
  return snapshot.docs.map((d) => ({ id: d.id, data: d.data() }))
}

/** The owner's one-time move of an old family to `adminUids`. */
export async function backfillAdminUids(familyId, uid) {
  await updateDoc(doc(db, FAMILIES, familyId), { adminUids: [uid] })
}

/** What the login page may know about a family before anyone signs in, or null. */
export async function getFamilyPublic(familyId) {
  const snap = await getDoc(doc(db, FAMILY_PUBLIC, familyId))
  return snap.exists() ? snap.data() : null
}

/**
 * Look up a family by its slug.
 *
 * Reads `familyPublic`, not `families`. The two carry the same slug, but only
 * `familyPublic` is world-readable — and it is written by a Cloud Function from
 * a fixed allowlist, so it cannot carry the encryption key or the password hash
 * however the private document grows. Callers here are unauthenticated by
 * definition: this is the login page and the signup form.
 *
 * Returns { id, ...publicFields } or null.
 */
export async function resolveFamilyBySlug(slug) {
  if (!db || !slug) return null

  const q = query(collection(db, FAMILY_PUBLIC), where('familySlug', '==', slug))
  const snapshot = await getDocs(q)

  if (snapshot.empty) return null

  const [found] = snapshot.docs
  return { id: found.id, ...found.data() }
}

/**
 * Check if a slug is available (not already taken by another family).
 *
 * Runs during signup, before the account exists, so it has to work without a
 * token — hence `familyPublic` again.
 */
export async function isSlugAvailable(slug, excludeFamilyId = null) {
  if (!db || !slug) return false

  const q = query(collection(db, FAMILY_PUBLIC), where('familySlug', '==', slug))
  const snapshot = await getDocs(q)

  if (snapshot.empty) return true

  // If we're excluding a specific family (for edits), check if the match is that family
  if (excludeFamilyId) {
    return snapshot.docs.every((d) => d.id === excludeFamilyId)
  }

  return false
}
