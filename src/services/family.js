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
  where,
} from '../config/firestore'
import { db } from '../config/firebase'
import { mediaRefsForMerge } from './mediaRefs'

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
  await setDoc(doc(db, FAMILIES, familyId), { ...fields, ...mediaRefsForMerge(fields) }, { merge: true })
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

/** The families `uid` is an admin of, as `{ id, data }`. */
export async function findAdminFamilies(uid) {
  const snapshot = await getDocs(query(collection(db, FAMILIES), where('adminUids', 'array-contains', uid)))
  return snapshot.docs.map((d) => ({ id: d.id, data: d.data() }))
}

/** What the login page may know about a family before anyone signs in, or null. */
export async function getFamilyPublic(familyId) {
  const snap = await getDoc(doc(db, FAMILY_PUBLIC, familyId))
  return snap.exists() ? snap.data() : null
}

const FAMILY_SLUGS = 'familySlugs'

// What generateSlug() produces. Anything else is not an address, and would not
// be a valid document id to look up (a slash makes doc() throw).
const isSlug = (value) => typeof value === 'string' && /^[a-z0-9-]{1,100}$/.test(value)

/**
 * Look up a family by its slug.
 *
 * Two single-document reads, because familyPublic cannot be listed: the
 * registry `familySlugs/{slug}` names the family holding the address, and
 * `familyPublic/{familyId}` is its public face. A query on familyPublic would
 * hand every login-page visitor the whole customer directory. The public copy
 * is world-readable and written by a Cloud Function from a fixed allowlist, so
 * it cannot carry the encryption key or the password hash however the private
 * document grows. Callers here are unauthenticated by definition: this is the
 * login page and the signup form.
 *
 * Returns { id, ...publicFields } or null.
 */
export async function resolveFamilyBySlug(slug) {
  if (!db || !isSlug(slug)) return null

  const claim = await getDoc(doc(db, FAMILY_SLUGS, slug))
  const familyId = claim.exists() ? claim.data().familyId : null
  if (!familyId) return null

  const found = await getDoc(doc(db, FAMILY_PUBLIC, familyId))
  // The mirror moves a moment after the registry on a rename; a copy that does
  // not carry the address yet is not this family's login page.
  if (!found.exists() || found.data().familySlug !== slug) return null

  return { id: found.id, ...found.data() }
}

/**
 * Check if a slug is available (not already taken by another family).
 *
 * Runs during signup, before the account exists, so it has to work without a
 * token — hence the registry, which is readable by address. A family from
 * before the registry is not in it until its next write, so this can say
 * "free" for such an address; the mirror function refuses the claim then.
 */
export async function isSlugAvailable(slug, excludeFamilyId = null) {
  if (!db || !isSlug(slug)) return false

  const claim = await getDoc(doc(db, FAMILY_SLUGS, slug))
  if (!claim.exists()) return true

  // If we're excluding a specific family (for edits), check if the claim is that family's
  return Boolean(excludeFamilyId) && claim.data().familyId === excludeFamilyId
}
