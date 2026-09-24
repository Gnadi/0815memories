/**
 * Who owns a family address (`<slug>.kaydo.app`).
 *
 * The login page finds a family by querying familyPublic for its slug and
 * taking the first match. Uniqueness used to be checked only by the browser
 * before signup or a rename, and nothing in firestore.rules enforced it — so
 * anyone could create a family carrying an existing family's slug. Firestore
 * returns equal matches in document-id order, and a client picks its own
 * document id, so that family could take over the other's address.
 *
 * `familySlugs/{slug}` is now the registry, written only here, through the
 * Admin SDK. familyPublic.familySlug — the one field the login page queries —
 * is mirrored only for the family holding the slug.
 *
 * Nothing here imports firebase-admin: the Firestore instance is passed in, so
 * the test suite can run this against the emulator with its own copy.
 */

export const SLUGS = 'familySlugs'

// What generateSlug() in src/utils/familySlug.js produces. Anything else was
// not written by the app, and is not a valid document id to look up either.
const isSlug = (value) => typeof value === 'string' && /^[a-z0-9-]{1,100}$/.test(value)

/**
 * Claim `slug` for `familyId`, or learn that another family holds it.
 *
 * Families from before the registry hold their slug only in their public
 * mirror. The first write to such a family registers it; until then, the
 * mirror itself counts as the claim, so nobody can register a slug a family
 * is already known by.
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} familyId
 * @param {string} slug
 * @returns {Promise<boolean>} whether `familyId` holds `slug` afterwards
 */
export async function claimFamilySlug(db, familyId, slug) {
  if (!isSlug(slug)) return false
  const ref = db.collection(SLUGS).doc(slug)

  return db.runTransaction(async (tx) => {
    const registered = await tx.get(ref)
    if (registered.exists) return registered.data().familyId === familyId

    const mirrors = await tx.get(db.collection('familyPublic').where('familySlug', '==', slug))
    if (mirrors.docs.some((doc) => doc.id !== familyId)) return false

    tx.set(ref, { familyId, claimedAt: new Date() })
    return true
  })
}

/** Give a slug back, if — and only if — `familyId` is the one holding it. */
export async function releaseFamilySlug(db, familyId, slug) {
  if (!isSlug(slug)) return
  const ref = db.collection(SLUGS).doc(slug)

  await db.runTransaction(async (tx) => {
    const registered = await tx.get(ref)
    if (registered.exists && registered.data().familyId === familyId) tx.delete(ref)
  })
}

/**
 * The slug a family's public mirror should carry after a write.
 *
 * `wanted` is the slug on the family document now, `previous` the one before
 * the write. A refused claim keeps the address the family already holds: a
 * rename that loses a race must not take the family's login page offline.
 *
 * @returns {Promise<string|null>} null when the family holds no address
 */
export async function publicSlugFor(db, familyId, wanted, previous) {
  if (wanted && (await claimFamilySlug(db, familyId, wanted))) {
    if (previous && previous !== wanted) await releaseFamilySlug(db, familyId, previous)
    return wanted
  }
  if (!wanted) {
    await releaseFamilySlug(db, familyId, previous)
    return null
  }
  if (previous && previous !== wanted && (await claimFamilySlug(db, familyId, previous))) {
    return previous
  }
  return null
}
