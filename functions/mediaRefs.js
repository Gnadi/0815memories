/**
 * Keeping the media ledger in step with the documents — phase 3 of
 * docs/plan-media-lifecycle.md.
 *
 * Documents that can hold media carry `mediaRefs` (src/services/mediaRefs.js):
 * a map from each field to the public ids of the files in it, worked out in the
 * browser before the field is encrypted. When a document is written, the ids
 * it gained are attached to it in the ledger, and the ids it lost — all of
 * them when it is deleted — are let go. A file no document holds any more is
 * `detached`, which is what the clean-up of phase 4 will look for. An attach
 * to a file the clean-up has reserved (`deleting`) cancels the reservation.
 *
 * Only files of the document's own family are touched. A document can name
 * any id it likes; an id whose ledger entry belongs to another family, or that
 * the ledger does not know, is ignored, so one family can neither keep another
 * family's files alive nor let them go. Files from before the ledger are the
 * exception: the first document to name one creates its entry (phase 5), and
 * such an entry is never deleted.
 *
 * Nothing here imports firebase-admin or firebase-functions, so the tests can
 * hand in a stand-in for Firestore.
 */
import { MEDIA_ASSETS, MEDIA_RATES } from './mediaSigning.js'

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

// More than this in one document is not a document the app wrote. The trigger
// does not act on it rather than let it fan out into hundreds of ledger
// transactions — but that means "unknown", never "references nothing": reading
// it as empty would let go of every file it shows, and the clean-up would
// delete them. See isOverCap.
export const MAX_MEDIA_REFS = 500

// The ids signUpload makes: `kaydo/<familyId>/<32 hex>`, or under
// `kaydo/public/`. Its ledger id is the last segment.
const PUBLIC_ID = /^kaydo\/(?:public\/)?[A-Za-z0-9_-]{1,100}\/([0-9a-f]{32})$/

// A file from before the ledger, as src/services/mediaRefs.js names it:
// `legacy:<resourceType>/<publicId>`. Those files were uploaded without a
// public id of their own, so Cloudinary chose the id: a random run of about
// twenty letters and digits, with the original's extension for a raw file.
// They went into the folders every family shared (`kaydo/encrypted`,
// `kaydo/videos`, `kaydo/audio` and `kaydo` itself) and, for the last two weeks
// before the ledger, into a folder per family
// (`kaydo/f/<familyId>/{encrypted,videos,audio,public}`, the signer of 10 to 23
// October 2026). Nothing else can be an old file, and a reference of any other
// shape is one a family invented: it would open a ledger entry for a file that
// does not exist, and legacy entries are never deleted.
const LEGACY_REF = /^legacy:(raw|image|video)\/(kaydo\/(?:(?:encrypted|videos|audio)\/|f\/[A-Za-z0-9_-]{1,100}\/(?:encrypted|videos|audio|public)\/)?[A-Za-z0-9]{16,24}(?:\.[A-Za-z0-9]{1,10})?)$/

// How many files from before the ledger one family can add to it in a day
// (UTC). A real family adds them when its admin runs the backfill
// (src/services/mediaIndex.js), which writes every media document in one go,
// one document at a time: a family that used the app for years can name a few
// thousand old photos, videos and thumbnails, and all of them must get through
// in that one run. Five thousand covers that with room to spare, and still
// keeps an invented flood to five thousand small documents a family a day
// instead of five hundred for every memory it writes. A reference over the
// limit gets no entry: the file is only left out of the family's usage, and
// nothing is deleted or hidden because of it. It is a parameter of the
// trigger (MEDIA_LEGACY_REFS_PER_DAY in functions/index.js).
export const LEGACY_REFS_PER_DAY = 5000

// What signUpload makes: `kaydo/<familyId>/<32 hex>`. A file with such an id
// was uploaded since the ledger and has, or had, a ledger entry of its own, so
// it is never "from before the ledger". Naming it as `legacy:` would let any
// family open a never-deleted entry for another family's file, so such a
// reference is not one the ledger can hold.
const SIGNED_ID = /^kaydo\/(?:public\/)?[A-Za-z0-9_-]{1,100}\/[0-9a-f]{32}$/

/** The resource type and public id of a file from before the ledger, or null. */
export function parseLegacyRef(ref) {
  const match = typeof ref === 'string' ? LEGACY_REF.exec(ref) : null
  if (!match || SIGNED_ID.test(match[2])) return null
  return { resourceType: match[1], publicId: match[2] }
}

/**
 * The ledger id of a reference, or null for one the ledger cannot hold. A file
 * from before the ledger gets one made from its resource type and public id,
 * which may hold slashes a document id cannot.
 */
export function ledgerIdOf(ref) {
  if (typeof ref !== 'string') return null
  const fresh = PUBLIC_ID.exec(ref)?.[1]
  if (fresh) return fresh
  const legacy = parseLegacyRef(ref)
  return legacy ? `legacy~${legacy.resourceType}~${encodeURIComponent(legacy.publicId)}` : null
}

/** The reference a ledger entry answers to. */
export const refOfEntry = (entry) =>
  entry.legacy ? `legacy:${entry.resourceType}/${entry.publicId}` : entry.publicId

/**
 * Every public id in a document's `mediaRefs`, or none if it is malformed.
 * The cap is not applied here: callers that must not trust a document this
 * size ask isOverCap, so no caller can mistake it for an empty one.
 */
export function refsOf(data) {
  const map = data?.mediaRefs
  if (!map || typeof map !== 'object' || Array.isArray(map)) return new Set()
  const ids = new Set()
  for (const list of Object.values(map)) {
    if (!Array.isArray(list)) continue
    for (const id of list) if (ledgerIdOf(id)) ids.add(id)
  }
  return ids
}

/**
 * Does this document name more files than the app ever writes? Its references
 * are then unknown: nothing may be attached to it or let go because of it, and
 * the clean-up must treat every file it names as still held.
 */
export const isOverCap = (data) => refsOf(data).size > MAX_MEDIA_REFS

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
 * Whether to attach or let go is read from the document as it is now, inside
 * the transaction, not from the write that triggered this. Triggers can arrive
 * out of order and more than once: a photo taken out and put back again in
 * two quick saves could be processed put-back first, and the ledger then
 * called a file "detached" that the document still showed — which the
 * clean-up would have deleted a month later. Reading the document makes every
 * run land on the same, current answer, whatever order they come in.
 *
 * A file from before the ledger has no entry until a document names it; the
 * first family to do so gets one, marked `legacy`. Those are counted, never
 * deleted: nothing proves which family uploaded them, so a family naming a URL
 * it found elsewhere must not be able to let another family's file go. When
 * no document holds one any more it becomes `unused`, a state the clean-up
 * does not look at.
 *
 * @param {string} collection
 * @param {string} docId
 * @param {string|null} writtenFamily  the family the triggering write named,
 *   for a document that no longer exists to say it
 * @param {number} legacyPerDay  how many new old-file entries a family may open a day
 * @returns {Promise<'attached'|'detached'|'kept'|'ignored'>}
 */
export async function reconcileRef(db, now, mediaRef, collection, docId, writtenFamily = null, legacyPerDay = LEGACY_REFS_PER_DAY) {
  const path = `${collection}/${docId}`
  const ref = db.collection(MEDIA_ASSETS).doc(ledgerIdOf(mediaRef))
  const source = db.collection(collection).doc(docId)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const sourceSnap = await tx.get(source)
    const current = sourceSnap.exists ? sourceSnap.data() : null
    const attach = refsOf(current).has(mediaRef)
    const familyId = familyOf(collection, docId, current) ?? (attach ? null : writtenFamily)

    const entry = snap.exists ? snap.data() : null
    const legacy = parseLegacyRef(mediaRef)
    if (!entry && legacy && attach && familyId) {
      // The family's count of new old-file entries today, kept next to the
      // upload counters. Read before anything is written.
      const day = new Date(now()).toISOString().slice(0, 10)
      const quotaRef = db.collection(MEDIA_RATES).doc(`legacy~${familyId}`)
      const quotaSnap = await tx.get(quotaRef)
      const quota = quotaSnap.exists ? quotaSnap.data() : {}
      const today = quota.day === day
      const used = today ? Number(quota.count) || 0 : 0
      if (used >= legacyPerDay) {
        // Said once a day and family, not once per file.
        if (!(today && quota.warned)) {
          tx.set(quotaRef, { day, count: used, warned: true })
          console.warn('[media] a family names more files from before the ledger than allowed a day; the rest are not recorded:', familyId)
        }
        return 'ignored'
      }
      tx.set(quotaRef, { day, count: used + 1, warned: false })
      tx.set(ref, {
        familyId,
        publicId: legacy.publicId,
        resourceType: legacy.resourceType,
        kind: 'legacy',
        legacy: true,
        state: 'attached',
        refs: [path],
        createdAt: new Date(now()),
        detachedAt: null,
      })
      return 'attached'
    }
    if (!entry && attach && !legacy) {
      // Every file signUpload signs gets an entry, and only the clean-up
      // removes one, so this is a document holding a file that has been
      // deleted — or an id that never was this app's. Worth seeing either way.
      console.warn('[media] a document names a file the ledger does not know:', path, ledgerIdOf(mediaRef))
    }
    if (!entry || !familyId || entry.familyId !== familyId || refOfEntry(entry) !== mediaRef) return 'ignored'

    const refs = new Set(Array.isArray(entry.refs) ? entry.refs : [])
    if (attach) refs.add(path)
    else refs.delete(path)

    // Past the point of no return (functions/mediaPurge.js): the file is being
    // or has been destroyed and cannot be saved. Only the reference is
    // recorded, so the clean-up sees the conflict and reports it.
    if (entry.state === 'destroying' || entry.state === 'lost') {
      tx.update(ref, { refs: [...refs].sort() })
      return attach ? 'attached' : 'detached'
    }
    if (refs.size > 0) {
      // A reference cancels a reservation in this same transaction. The
      // clean-up moves `deleting` to `destroying` in a transaction on this
      // entry too, so exactly one of the two wins. The reservation's fields
      // are nulled, not removed: this module has no FieldValue.delete.
      const cancel = entry.state === 'deleting' ? { deletingSince: null, deletingFrom: null } : {}
      tx.update(ref, { refs: [...refs].sort(), state: 'attached', detachedAt: null, ...cancel })
      return attach ? 'attached' : 'kept'
    }
    // A file no document ever held stays pending: it was abandoned, not let go.
    if (entry.state === 'pending') return 'ignored'
    // Already let go by an earlier run for the same document: keep the date
    // the grace period counts from.
    // A reservation stays one: the file was let go, and the clean-up decides.
    if (entry.state === 'detached' || entry.state === 'unused' || entry.state === 'deleting') return 'detached'
    // `detachedFrom` lets the clean-up look at that document once more before
    // it deletes anything (functions/mediaPurge.js).
    tx.update(ref, {
      refs: [],
      state: entry.legacy ? 'unused' : 'detached',
      detachedAt: new Date(now()),
      detachedFrom: path,
    })
    return 'detached'
  })
}

/**
 * Bring the ledger in line with one document write.
 *
 * @param {{ db: any, now?: () => number, legacyPerDay?: number }} deps
 * @param {{ collection: string, docId: string, before: object|null, after: object|null }} write
 * @returns {Promise<{ attached: number, detached: number, ignored: number }>}
 */
export async function trackMediaRefs({ db, now = Date.now, legacyPerDay = LEGACY_REFS_PER_DAY }, { collection, docId, before, after }) {
  const stats = { attached: 0, detached: 0, ignored: 0 }
  if (!MEDIA_COLLECTIONS.includes(collection)) return stats
  // Neither side of an over-cap write can be trusted to say what was lost, and
  // letting go of what the other side lacks would detach files still shown.
  // Leaving the ledger alone is the safe answer: the files stay as they were.
  if (isOverCap(before) || isOverCap(after)) return stats

  // The write only says which files to look at; what each one's state should
  // be comes from the document itself (reconcileRef says why).
  const { added, removed, removedFamily } = refChanges(collection, docId, before, after)

  const reconcile = (id) => reconcileRef(db, now, id, collection, docId, removedFamily, legacyPerDay)
  // Files from before the ledger share one counter per family, which every
  // new entry updates in its own transaction: one after the other, so a
  // backfilled document with many of them does not make its transactions
  // fight over that counter.
  const [old, fresh] = [[], []]
  for (const id of [...added, ...removed]) (parseLegacyRef(id) ? old : fresh).push(id)
  const results = await Promise.all(fresh.map(reconcile))
  for (const id of old) results.push(await reconcile(id))
  for (const result of results) {
    if (result === 'attached') stats.attached++
    else if (result === 'detached') stats.detached++
    else if (result === 'ignored') stats.ignored++
  }
  return stats
}
