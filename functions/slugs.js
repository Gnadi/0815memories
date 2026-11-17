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

// Addresses that look like the service's own and are not for a family to
// claim: `login.kaydo.app` would be a ready-made phishing page. The list is
// repeated in src/utils/familySlug.js for the signup form, and a test keeps
// the two equal. It only stops a NEW claim: a family that already holds one of
// these keeps it, so isSlug stays a format check and the block sits in
// claimFamilySlug.
export const RESERVED_SLUGS = ['www', 'api', 'app', 'admin', 'login', 'auth', 'support', 'help', 'mail', 'status', 'billing', 'account', 'security', 'kaydo', 'demo', 'static', 'assets', 'cdn']

/**
 * Claim `slug` for `familyId`, or learn that another family holds it.
 *
 * Families from before the registry hold their slug only in their public
 * mirror. The first write to such a family registers it; until then, the
 * mirror itself counts as the claim, so nobody can register a slug a family
 * is already known by.
 *
 * A reserved slug is given to nobody new. A family that holds one already —
 * in the registry, or only in its own mirror — keeps it.
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
    if (RESERVED_SLUGS.includes(slug) && !mirrors.docs.some((doc) => doc.id === familyId)) return false

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

// The marker functions/familyDeletion.js writes when a deletion has begun. That
// module imports this one, so the name is repeated here; a test keeps the two
// equal.
export const DELETION_MARKERS = 'familyDeletions'

/**
 * Bring `familyPublic/{familyId}` and the slug registry in step with the family
 * document as it is now.
 *
 * The mirror trigger is retried for up to an hour and not delivered in order, so
 * an event can describe a family that has changed since. Nothing is taken from
 * the event: the family document is read here, in the same transaction that
 * writes, so a family deleted a moment later conflicts with this write and the
 * run starts over and sees it gone. A stale event then cannot bring back a
 * login image that was removed, nor the mirror or the address of a family that
 * was deleted.
 *
 * What the family holds in the registry is looked up by `familyId`, not taken
 * from the event's "before" document: a stale "before" could name an address the
 * family no longer holds, or one it has just moved to.
 *
 * A family whose deletion has begun is left alone. Its family document is still
 * there until the last steps, and the deletion removes the mirror and the
 * address itself (functions/familyDeletion.js).
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} familyId
 * @param {string[]} fields  the allowlist of public fields
 * @returns {Promise<'mirrored'|'removed'|'deleting'>}
 */
export async function mirrorFamily(db, familyId, fields) {
  const familyRef = db.doc(`families/${familyId}`)
  const publicRef = db.doc(`familyPublic/${familyId}`)

  return db.runTransaction(async (tx) => {
    const [family, marker, held] = await Promise.all([
      tx.get(familyRef),
      tx.get(db.collection(DELETION_MARKERS).doc(familyId)),
      tx.get(db.collection(SLUGS).where('familyId', '==', familyId)),
    ])

    if (!family.exists) {
      for (const entry of held.docs) tx.delete(entry.ref)
      tx.delete(publicRef)
      return 'removed'
    }
    if (marker.exists) return 'deleting'

    const data = family.data() || {}
    const mirror = {}
    for (const field of fields) {
      if (data[field] !== undefined) mirror[field] = data[field]
    }

    // The address is the one public field that has to be unique, and the family
    // document cannot promise that — any signed-in client can write any slug to
    // it. So the mirror carries only a slug this family holds in the registry.
    // The wanted one first; a refused claim keeps the address the family
    // already holds, so a rename that loses a race does not take its login page
    // offline. Families from before the registry hold theirs only in the mirror.
    const heldSlugs = held.docs.map((entry) => entry.id)
    let slug = null
    let register = null
    if (data.familySlug) {
      const candidates = [data.familySlug, ...heldSlugs]
      const current = await tx.get(publicRef)
      if (current.exists) candidates.push(current.data().familySlug)
      for (const candidate of new Set(candidates)) {
        if (!isSlug(candidate)) continue
        if (heldSlugs.includes(candidate)) { slug = candidate; break }
        const registered = await tx.get(db.collection(SLUGS).doc(candidate))
        if (registered.exists) continue
        const mirrors = await tx.get(db.collection('familyPublic').where('familySlug', '==', candidate))
        if (mirrors.docs.some((doc) => doc.id !== familyId)) continue
        if (RESERVED_SLUGS.includes(candidate) && !mirrors.docs.some((doc) => doc.id === familyId)) continue
        slug = candidate
        register = candidate
        break
      }
    }

    if (register) tx.set(db.collection(SLUGS).doc(register), { familyId, claimedAt: new Date() })
    for (const entry of held.docs) if (entry.id !== slug) tx.delete(entry.ref)
    if (slug) mirror.familySlug = slug
    else delete mirror.familySlug

    // set() without merge, so a field cleared on the private document is cleared
    // here too rather than lingering in public forever.
    tx.set(publicRef, mirror)
    return 'mirrored'
  })
}
