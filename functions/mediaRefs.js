/**
 * Keeping the media ledger in step with the documents — phase 3 of
 * docs/plan-media-lifecycle.md.
 *
 * Documents that can hold media carry `mediaRefs` (src/services/mediaRefs.js):
 * a map from each field to the public ids of the files in it, worked out in the
 * browser before the field is encrypted. When a document is written, the ids
 * it gained are attached to it in the ledger, and the ids it lost — all of
 * them when it is deleted — are let go. A file no document holds any more is
 * `detached`, which is what the clean-up of phase 4 will look for.
 *
 * Only files of the document's own family are touched. A document can name
 * any id it likes; an id whose ledger entry belongs to another family, or that
 * the ledger does not know, is ignored, so one family can neither keep another
 * family's files alive nor let them go.
 *
 * Nothing here imports firebase-admin or firebase-functions, so the tests can
 * hand in a stand-in for Firestore.
 */
import { MEDIA_ASSETS } from './mediaSigning.js'

// The collections whose documents can carry `mediaRefs`. The family document
// holds the login page's pictures; its family is its own id.
export const MEDIA_COLLECTIONS = [
  'memories',
  'moments',
  'children',
  'journals',
  'blackbox',
  'blackboxContent',
  'scrapbooks',
  'collages',
  'highlights',
  'bestOf',
  'recipes',
  'ourYearChapters',
  'families',
]

// More than this in one document is not a document the app wrote, and is
// ignored rather than let fan out into hundreds of ledger transactions.
export const MAX_MEDIA_REFS = 500

// The ids signUpload makes: `kaydo/<familyId>/<32 hex>`, or under
// `kaydo/public/`. Its ledger id is the last segment.
const PUBLIC_ID = /^kaydo\/(?:public\/)?[A-Za-z0-9_-]{1,100}\/([0-9a-f]{32})$/

/** The ledger id of a public id, or null for one the ledger cannot hold. */
export function ledgerIdOf(publicId) {
  return typeof publicId === 'string' ? (PUBLIC_ID.exec(publicId)?.[1] ?? null) : null
}

/** Every public id in a document's `mediaRefs`, or none if it is malformed. */
export function refsOf(data) {
  const map = data?.mediaRefs
  if (!map || typeof map !== 'object' || Array.isArray(map)) return new Set()
  const ids = new Set()
  for (const list of Object.values(map)) {
    if (!Array.isArray(list)) continue
    for (const id of list) if (ledgerIdOf(id)) ids.add(id)
  }
  return ids.size > MAX_MEDIA_REFS ? new Set() : ids
}

/** The family a document belongs to. */
export function familyOf(collection, docId, data) {
  if (!data) return null
  if (collection === 'families') return docId
  return typeof data.familyId === 'string' ? data.familyId : null
}

/**
 * What a write changed: the ids to attach to the document and the ids to let
 * go, each with the family it was checked against.
 */
export function refChanges(collection, docId, before, after) {
  const was = refsOf(before)
  const is = refsOf(after)
  return {
    added: [...is].filter((id) => !was.has(id)),
    removed: [...was].filter((id) => !is.has(id)),
    addedFamily: familyOf(collection, docId, after),
    removedFamily: familyOf(collection, docId, before),
  }
}

/**
 * Attach or let go of one file for one document, in a transaction, so two
 * documents changing the same file at once cannot lose a reference.
 *
 * @returns {Promise<'attached'|'detached'|'kept'|'ignored'>}
 */
async function applyOne(db, now, publicId, familyId, path, attach) {
  const ref = db.collection(MEDIA_ASSETS).doc(ledgerIdOf(publicId))
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const entry = snap.exists ? snap.data() : null
    if (!entry || !familyId || entry.familyId !== familyId || entry.publicId !== publicId) return 'ignored'

    const refs = new Set(Array.isArray(entry.refs) ? entry.refs : [])
    if (attach) refs.add(path)
    else refs.delete(path)

    if (refs.size > 0) {
      tx.update(ref, { refs: [...refs].sort(), state: 'attached', detachedAt: null })
      return attach ? 'attached' : 'kept'
    }
    // A file no document ever held stays pending: it was abandoned, not let go.
    if (entry.state === 'pending') return 'ignored'
    tx.update(ref, { refs: [], state: 'detached', detachedAt: new Date(now()) })
    return 'detached'
  })
}

/**
 * Bring the ledger in line with one document write.
 *
 * @param {{ db: any, now?: () => number }} deps
 * @param {{ collection: string, docId: string, before: object|null, after: object|null }} write
 * @returns {Promise<{ attached: number, detached: number, ignored: number }>}
 */
export async function trackMediaRefs({ db, now = Date.now }, { collection, docId, before, after }) {
  const stats = { attached: 0, detached: 0, ignored: 0 }
  if (!MEDIA_COLLECTIONS.includes(collection)) return stats

  const path = `${collection}/${docId}`
  const { added, removed, addedFamily, removedFamily } = refChanges(collection, docId, before, after)

  const results = await Promise.all([
    ...added.map((id) => applyOne(db, now, id, addedFamily, path, true)),
    ...removed.map((id) => applyOne(db, now, id, removedFamily, path, false)),
  ])
  for (const result of results) {
    if (result === 'attached') stats.attached++
    else if (result === 'detached') stats.detached++
    else if (result === 'ignored') stats.ignored++
  }
  return stats
}
