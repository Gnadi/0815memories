/**
 * Deleting a whole family, which only its owner can ask for (deleteFamily in
 * index.js).
 *
 * What has to happen at once happens in startFamilyDeletion: nobody can sign
 * in to the family any more, and its key leaves the family document, so a
 * session still open cannot load it again. The key moves to
 * familyDeletions/<familyId>, which no client can read (firestore.rules),
 * because the files from before the family folders can only be told apart by
 * it (functions/purge.js).
 *
 * The rest is runFamilyDeletion's, which can take more than one run for a
 * large family: every document of the family with the files it names, the
 * family's folder on Cloudinary, the printed books' files, the accounts, the
 * family document, and last the deletion record, key and all. Each part is
 * safe to repeat, so a run cut short leaves nothing that the next one cannot
 * pick up. The record's trigger starts it; purgeTrash looks again every hour.
 *
 * Nothing here imports firebase-admin: the services come in as arguments.
 */
import { deleteFiles, deleteFolder, familyFiles, familyFolder, mediaIn, rawKey } from './purge.js'
import { safeKey } from './viewerLogin.js'
import { PRINT_FILES_PREFIX } from './printFiles.js'

export const DELETIONS = 'familyDeletions'

// Every top-level collection that holds a family's documents, by `familyId`.
// A new collection belongs here, or a deleted family leaves it behind.
export const FAMILY_COLLECTIONS = [
  'memories', 'moments', 'albums', 'children', 'journals', 'blackbox', 'blackboxContent',
  'recipes', 'scrapbooks', 'collages', 'highlights',
  'ourYearRituals', 'ourYearChapters', 'ourYearEntries', 'ourYearLetters',
  'trash', 'mediaDeletions', 'fcmTokens', 'viewerDevices', 'feedback',
]

// The family document's own subcollections.
const FAMILY_SUBCOLLECTIONS = ['admins', 'invites', 'secrets']

const PAGE = 200

export class DeletionError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

const adminUidsOf = (data) => {
  const list = Array.isArray(data?.adminUids) ? data.adminUids : []
  return list.length ? list : data?.adminUid ? [data.adminUid] : []
}

const ignoreMissingUser = (err) => {
  if (err?.code !== 'auth/user-not-found') throw err
}

/**
 * The part that cannot wait. Owner only, asked of the family document rather
 * than the token's claim: a claim outlives a change of hands by up to an hour.
 */
export async function startFamilyDeletion({ db, auth, deleteField, now = new Date() }, uid, familyId) {
  if (typeof familyId !== 'string' || !familyId || familyId.includes('/')) {
    throw new DeletionError('invalid-argument', 'No family')
  }
  const familyRef = db.doc(`families/${familyId}`)
  const family = await familyRef.get()
  if (!family.exists) throw new DeletionError('not-found', 'No such family')
  const data = family.data()
  if (!uid || data.adminUid !== uid) throw new DeletionError('permission-denied', 'Only the owner can delete the family')

  // Its admins and its guests, who share one identity.
  const uids = [...new Set([...adminUidsOf(data), `viewer:${familyId}`])]
  for (const account of uids) {
    await auth.updateUser(account, { disabled: true }).catch(ignoreMissingUser)
    await auth.revokeRefreshTokens(account).catch(ignoreMissingUser)
  }

  // In one batch: the key is never in neither place, and never left in both.
  // A second request finds the record and keeps the key it already holds.
  const recordRef = db.doc(`${DELETIONS}/${familyId}`)
  const existing = await recordRef.get()
  const batch = db.batch()
  batch.set(recordRef, {
    familyId,
    requestedBy: uid,
    requestedAt: now,
    key: existing.exists ? existing.data().key : (data.encryptionKeyJwk ?? null),
    uids,
    slug: data.familySlug ?? null,
  })
  // mirrorFamilyPublic takes the login page down when it sees this.
  batch.update(familyRef, { encryptionKeyJwk: deleteField(), deletionRequestedAt: now })
  await batch.commit()
  return { uids }
}

/** Deletes `query`'s documents a page at a time, with the files they name. */
async function deleteDocuments(query, { db, familyId, key, fetchBytes, cloudinary, outOfTime }) {
  for (;;) {
    if (outOfTime()) return false
    const page = await query.limit(PAGE).get()
    if (page.empty) return true
    const urls = page.docs.flatMap((doc) => [...mediaIn(doc.data())])
    if (urls.length) {
      const { owned } = await familyFiles(urls, { familyId, key, cloudName: cloudinary.cloudName, fetchBytes })
      await deleteFiles(owned, cloudinary)
    }
    const batch = db.batch()
    for (const doc of page.docs) batch.delete(doc.ref)
    await batch.commit()
  }
}

/**
 * Works through a family's deletion until it is done or `deadline` (ms since
 * the epoch) comes. Returns true once nothing of the family is left.
 */
export async function runFamilyDeletion(record, { db, auth, bucket, fetchBytes, cloudinary, deadline = Infinity }) {
  const { familyId } = record
  const key = rawKey(record.key)
  const outOfTime = () => Date.now() > deadline
  const context = { db, familyId, key, fetchBytes, cloudinary, outOfTime }

  for (const name of FAMILY_COLLECTIONS) {
    const done = await deleteDocuments(db.collection(name).where('familyId', '==', familyId), context)
    if (!done) return false
  }
  for (const name of FAMILY_SUBCOLLECTIONS) {
    const done = await deleteDocuments(db.collection(`families/${familyId}/${name}`), context)
    if (!done) return false
  }

  // Whatever the documents no longer named: uploads that never made it into
  // one, and the login page's pictures.
  await deleteFolder(familyFolder(familyId), cloudinary)
  if (bucket) await bucket.deleteFiles({ prefix: `${PRINT_FILES_PREFIX}${familyId}/` })

  await db.doc(`familyPublic/${familyId}`).delete()
  if (record.slug) {
    const slug = await db.doc(`familySlugs/${record.slug}`).get()
    if (slug.exists && slug.data().familyId === familyId) await slug.ref.delete()
  }
  await db.doc(`rateLimits/${safeKey('viewerLogin', familyId)}`).delete()

  for (let i = 0; i < (record.uids ?? []).length; i += 1000) {
    await auth.deleteUsers(record.uids.slice(i, i + 1000))
  }

  await db.doc(`families/${familyId}`).delete()
  // Last: with the record goes the key, and with it every file it still
  // could have told apart.
  await db.doc(`${DELETIONS}/${familyId}`).delete()
  return true
}
