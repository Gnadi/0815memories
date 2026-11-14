/**
 * Deleting a family, for good.
 *
 * The owner asks for it, and nothing happens for DELETION_GRACE_DAYS: the
 * family document carries the date (`deletion`), the app shows it to every
 * admin, and the owner can take the request back. After that a daily run
 * deletes everything the family has: its documents, its files on Cloudinary,
 * its print files, its viewer identity, the owner's account, and last the
 * family document itself.
 *
 * That is many deletes in three systems, and any of them can fail halfway. So
 * the run does not keep track of how far it got. Every step deletes "whatever
 * of this family is still there", which is safe to do twice, and a run that
 * stops — an error, Cloudinary down, out of time — is simply started again the
 * next day. A marker in `familyDeletions` says a deletion has begun: from then
 * on it cannot be taken back, and it is found again even once the family
 * document is gone.
 *
 * Files from before the media ledger are the one thing left behind. Nothing
 * proves which family uploaded one (functions/mediaRefs.js), so deleting the
 * files a family merely named would let it delete another family's. Their
 * ledger entries go; the files are counted in the log for the operator.
 *
 * Nothing here imports firebase-admin or firebase-functions: Firestore, the
 * bucket, Auth, the Cloudinary call and the clock come in as arguments, so the
 * tests can stub them.
 */
import { MEDIA_ASSETS, MEDIA_RATES, MEDIA_USAGE } from './mediaSigning.js'
import { DESTROY_BATCH, destroyUnderOtherTypes } from './mediaPurge.js'
import { PRINT_FILES_PREFIX } from './printFiles.js'
import { releaseFamilySlug } from './slugs.js'
import { DEVICES, safeKey } from './viewerLogin.js'

/** Mirrored by DELETION_GRACE_DAYS in src/services/familyDeletion.js, which tells the owner. */
export const DELETION_GRACE_DAYS = 14

/** One document per deletion that has begun, named after the family. Admin SDK only. */
export const FAMILY_DELETIONS = 'familyDeletions'

/**
 * Every top-level collection whose documents carry a `familyId`.
 * familyDeletionCoverage.test.js reads firestore.rules and fails when a
 * collection there is in neither this list nor OTHER_COLLECTIONS: a new
 * collection has to say what happens to it when its family is deleted.
 */
export const FAMILY_COLLECTIONS = [
  'memories',
  'moments',
  'albums',
  'children',
  'journals',
  'blackbox',
  'blackboxContent',
  'scrapbooks',
  'collages',
  'highlights',
  'bestOf',
  'recipes',
  'ourYearRituals',
  'ourYearChapters',
  'ourYearEntries',
  'ourYearLetters',
  'fcmTokens',
  'feedback',
  DEVICES,
]

/** The family document's subcollections. */
export const FAMILY_SUBCOLLECTIONS = ['admins', 'invites', 'secrets']

/**
 * The collections of firestore.rules that are not in FAMILY_COLLECTIONS, each
 * with where its part of a family goes — or why it holds none.
 */
export const OTHER_COLLECTIONS = {
  families: 'the family document, deleted last',
  familyPublic: 'deleted with the family document',
  familySlugs: 'released with the family document',
  mediaAssets: 'deleted with the files they stand for',
  mediaUsage: 'named after the family, deleted',
  mediaRates: 'named after an admin, deleted for the owner',
  mediaReports: 'the operator\'s inventory, holds no family',
  rateLimits: 'the family\'s and its devices\' login counters, deleted',
  notificationsQueue: 'retired and closed',
  [FAMILY_DELETIONS]: 'the marker of this very run',
}

const DAY_MS = 24 * 60 * 60 * 1000
const FAMILY_ID = /^[A-Za-z0-9_-]{1,100}$/
// Documents deleted per round. Each delete fires the media trigger, so this
// also bounds how many of those start at once.
const PAGE = 200

export class DeletionError extends Error {
  /** @param {'unauthenticated'|'invalid-argument'|'permission-denied'|'failed-precondition'} code */
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

const millis = (value) => {
  if (value == null) return NaN
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return Number(value)
}

/**
 * The family, if `uid` owns it. The owner is `adminUid`, the account that
 * founded the family and that the rules never let leave it — not any admin:
 * a co-admin can be invited in a minute, and this cannot be undone.
 */
async function ownedFamily(tx, db, uid, data) {
  if (!uid) throw new DeletionError('unauthenticated', 'Sign in first')
  const familyId = typeof data?.familyId === 'string' ? data.familyId : ''
  if (!FAMILY_ID.test(familyId)) throw new DeletionError('invalid-argument', 'No family given')
  const ref = db.doc(`families/${familyId}`)
  const snap = await tx.get(ref)
  if (!snap.exists || snap.data().adminUid !== uid) {
    throw new DeletionError('permission-denied', 'Only the owner can delete the family')
  }
  return { familyId, ref, family: snap.data() }
}

/**
 * Schedule a family's deletion. Asking again changes nothing: the date stays
 * the one the owner was first told.
 *
 * @param {{ db: any, now?: () => number }} deps
 * @param {string|undefined} uid  the caller, from the verified ID token
 * @param {{ familyId?: unknown }} data
 * @returns {Promise<{ deleteAfter: string }>}
 */
export async function requestDeletion({ db, now = Date.now }, uid, data) {
  return db.runTransaction(async (tx) => {
    const { ref, family } = await ownedFamily(tx, db, uid, data)
    const scheduled = millis(family.deletion?.deleteAfter)
    if (Number.isFinite(scheduled)) return { deleteAfter: new Date(scheduled).toISOString() }

    const requestedAt = new Date(now())
    const deleteAfter = new Date(requestedAt.getTime() + DELETION_GRACE_DAYS * DAY_MS)
    tx.update(ref, { deletion: { requestedBy: uid, requestedAt, deleteAfter } })
    return { deleteAfter: deleteAfter.toISOString() }
  })
}

/**
 * Take a scheduled deletion back. Refused once the deletion has begun: part of
 * the family is gone by then, and what is left must not look kept.
 *
 * @param {{ db: any }} deps
 * @param {string|undefined} uid
 * @param {{ familyId?: unknown }} data
 */
export async function cancelDeletion({ db }, uid, data) {
  return db.runTransaction(async (tx) => {
    const { familyId, ref } = await ownedFamily(tx, db, uid, data)
    const marker = await tx.get(db.collection(FAMILY_DELETIONS).doc(familyId))
    if (marker.exists) throw new DeletionError('failed-precondition', 'The deletion has already begun')
    // null rather than a removed field, so the rules can compare it and this
    // module needs no FieldValue.
    tx.update(ref, { deletion: null })
    return { ok: true }
  })
}

/**
 * The families to delete in this run: the ones whose date has come, and the
 * ones an earlier run began and did not finish.
 */
export async function familiesToDelete(db, now) {
  const [due, begun] = await Promise.all([
    db.collection('families').where('deletion.deleteAfter', '<=', new Date(now)).get(),
    db.collection(FAMILY_DELETIONS).get(),
  ])
  return [...new Set([...begun.docs.map((d) => d.id), ...due.docs.map((d) => d.id)])]
}

/** Delete every document a query finds, a page at a time. False when time ran out first. */
async function deleteAll(query, outOfTime, each) {
  for (;;) {
    if (outOfTime()) return false
    const page = await query.limit(PAGE).get()
    if (page.docs.length === 0) return true
    if (each) await Promise.all(page.docs.map(each))
    await Promise.all(page.docs.map((snap) => snap.ref.delete()))
  }
}

async function deleteFamilyDocuments(db, familyId, outOfTime, stats) {
  for (const name of FAMILY_COLLECTIONS) {
    const done = await deleteAll(
      db.collection(name).where('familyId', '==', familyId),
      outOfTime,
      async (snap) => {
        stats.documents++
        // A remembered device has a login counter of its own.
        if (name === DEVICES) await db.doc(`rateLimits/viewerDevice__${snap.id}`).delete()
      },
    )
    if (!done) return false
  }
  return true
}

/**
 * Destroy the family's files and forget them. A ledger entry leaves only once
 * Cloudinary has confirmed its file is gone, so a refused delete is tried
 * again by the next run rather than forgotten.
 */
async function deleteFamilyMedia(db, familyId, destroy, outOfTime, stats) {
  const assets = db.collection(MEDIA_ASSETS).where('familyId', '==', familyId)
  for (;;) {
    if (outOfTime()) return false
    const page = await assets.limit(PAGE).get()
    if (page.docs.length === 0) return true

    const byType = new Map()
    const forget = []
    for (const snap of page.docs) {
      const entry = snap.data()
      if (entry.legacy || typeof entry.publicId !== 'string' || !entry.resourceType) {
        if (entry.legacy) stats.legacyFilesKept++
        forget.push(snap)
        continue
      }
      const list = byType.get(entry.resourceType) ?? []
      list.push({ snap, publicId: entry.publicId })
      byType.set(entry.resourceType, list)
    }

    let refused = 0
    for (const [resourceType, entries] of byType) {
      if (!destroy) {
        refused += entries.length
        continue
      }
      for (let i = 0; i < entries.length; i += DESTROY_BATCH) {
        const batch = entries.slice(i, i + DESTROY_BATCH)
        const gone = await destroy(resourceType, batch.map((entry) => entry.publicId))
        // A signature can be used once per resource type (mediaPurge.js).
        await destroyUnderOtherTypes(destroy, resourceType, batch.map((entry) => entry.publicId).filter((id) => gone.has(id)))
        for (const entry of batch) {
          if (gone.has(entry.publicId)) forget.push(entry.snap)
          else refused++
        }
      }
    }

    await Promise.all(forget.map((snap) => snap.ref.delete()))
    stats.files += forget.length
    // The refused ones would come back as the next page, for ever.
    if (refused > 0) {
      stats.filesRefused += refused
      return false
    }
  }
}

async function deletePrintFiles(bucket, familyId, stats) {
  const [files] = await bucket.getFiles({ prefix: `${PRINT_FILES_PREFIX}${familyId}/` })
  await Promise.all(files.map((file) => file.delete()))
  stats.printFiles += files.length
}

const isMissingUser = (error) => error?.code === 'auth/user-not-found'

/**
 * Delete the owner's account, unless it is an admin of another family: the
 * account is how they sign in there. The co-admins keep theirs. They did not
 * ask for this, and syncAdminClaims takes their claim when the family
 * document goes.
 */
async function deleteAccounts(db, auth, familyId, ownerUid, stats) {
  await auth.deleteUser(`viewer:${familyId}`).catch((error) => {
    if (!isMissingUser(error)) throw error
  })
  if (!ownerUid) return
  const others = await db.collection('families').where('adminUids', 'array-contains', ownerUid).limit(1).get()
  if (others.docs.length > 0) return
  await db.collection(MEDIA_RATES).doc(ownerUid).delete()
  await auth.deleteUser(ownerUid).then(
    () => { stats.ownerAccountDeleted = true },
    (error) => {
      if (!isMissingUser(error)) throw error
    },
  )
}

/**
 * Delete one family, or as much of it as this run gets to.
 *
 * @param {object} deps
 * @param {any} deps.db
 * @param {{ getFiles: (options: object) => Promise<[Array<{ delete: () => Promise<unknown> }>]> }} deps.bucket
 * @param {{ deleteUser: (uid: string) => Promise<unknown> }} deps.auth
 * @param {((resourceType: string, publicIds: string[]) => Promise<Set<string>>)|null} deps.destroy
 *   cloudinaryDestroyer, or null when Cloudinary is not configured
 * @param {() => number} [deps.now]
 * @param {number} [deps.deadline]  stop starting new work after this time
 * @param {string} familyId
 * @returns {Promise<{ outcome: 'deleted'|'incomplete'|'not-due', documents: number, files: number, filesRefused: number, legacyFilesKept: number, printFiles: number, ownerAccountDeleted: boolean }>}
 */
export async function deleteFamily(deps, familyId) {
  const { db, bucket, auth, destroy, now = Date.now, deadline = Infinity } = deps
  const stats = { outcome: 'incomplete', documents: 0, files: 0, filesRefused: 0, legacyFilesKept: 0, printFiles: 0, ownerAccountDeleted: false }
  const outOfTime = () => now() > deadline

  const familyRef = db.doc(`families/${familyId}`)
  const markerRef = db.collection(FAMILY_DELETIONS).doc(familyId)

  // Begin, or pick up where an earlier run stopped. Decided in a transaction
  // with the family document, so a request taken back in this very moment
  // either wins — nothing begins — or finds the marker and is refused.
  const marker = await db.runTransaction(async (tx) => {
    const [existing, family] = await Promise.all([tx.get(markerRef), tx.get(familyRef)])
    if (existing.exists) return existing.data()
    const due = family.exists && millis(family.data().deletion?.deleteAfter) <= now()
    if (!due) return null
    // The owner and the address are needed after the family document is gone.
    const begun = {
      ownerUid: family.data().adminUid ?? null,
      familySlug: family.data().familySlug ?? null,
      startedAt: new Date(now()),
    }
    tx.set(markerRef, begun)
    return begun
  })
  if (!marker) return { ...stats, outcome: 'not-due' }

  if (!(await deleteFamilyDocuments(db, familyId, outOfTime, stats))) return stats
  if (!(await deleteFamilyMedia(db, familyId, destroy, outOfTime, stats))) return stats
  await deletePrintFiles(bucket, familyId, stats)

  for (const name of FAMILY_SUBCOLLECTIONS) {
    if (!(await deleteAll(db.collection(`families/${familyId}/${name}`), outOfTime))) return stats
  }
  await db.collection(MEDIA_USAGE).doc(familyId).delete()
  await db.doc(`rateLimits/${safeKey('viewerLogin', familyId)}`).delete()

  // The family document last: until it goes, the rules still know the family,
  // and its admins can see that the deletion is under way. The mirror and the
  // address are removed here as well as by mirrorFamilyPublic, whose own
  // attempt is not retried.
  await familyRef.delete()
  await db.doc(`familyPublic/${familyId}`).delete()
  await releaseFamilySlug(db, familyId, marker.familySlug)

  // With the family document gone the rules refuse every write, so this
  // catches what an admin's open tab saved while the run was going.
  if (!(await deleteFamilyDocuments(db, familyId, outOfTime, stats))) return stats

  await deleteAccounts(db, auth, familyId, marker.ownerUid, stats)
  await markerRef.delete()
  return { ...stats, outcome: 'deleted' }
}
