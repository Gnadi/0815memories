/**
 * Deleting the files nothing uses — phase 4 of docs/plan-media-lifecycle.md.
 *
 * The ledger knows two kinds of file nobody needs: `pending` ones, signed but
 * never held by a document (an editor closed without saving, a thumbnail whose
 * write was discarded), and `detached` ones, whose last document let them go.
 * Once they have been so for long enough, they are destroyed on Cloudinary and
 * leave the ledger, and their size leaves the family's usage.
 *
 * Deleting a family's photo cannot be undone, so the rules here lean the other
 * way at every step:
 *
 * - Only files signed into the ledger are touched. A file from before it is
 *   never deleted here, whether or not a document names it.
 * - The grace periods are long: a week for a pending file, because an editor
 *   can stay open over a weekend before it saves; thirty days for a detached
 *   one, time to notice a mistake.
 * - It starts as a dry run that only reports what it would delete, and a dry
 *   run changes nothing in the ledger.
 *
 * A file is deleted in two steps, a night apart, on its ledger entry:
 *
 * 1. A run that finds a file due *reserves* it: `deleting`, with the time.
 *    Nothing is destroyed. A document write and the trigger that records it
 *    (functions/mediaRefs.js) are asynchronous, so a check before the destroy
 *    cannot see a reference whose trigger has not run yet, and a conflict
 *    noticed after the destroy protects nothing. The reservation moves the
 *    conflict in front of the delete: a trigger that attaches the file
 *    cancels the reservation in a transaction on the same entry, and the
 *    clean-up and the trigger exclude each other there. A reservation gives
 *    every pending trigger a full run interval to land.
 * 2. A run at least RESERVATION_MS later looks once more at the document that
 *    let the file go, then, in a transaction that needs the entry still to be
 *    `deleting` with no references, moves it to `destroying`. That is the
 *    point of no return: from there a trigger can only record the reference
 *    (so the conflict is visible), not save the file. Only then is Cloudinary
 *    asked. An entry stays `destroying`, and every later run asks again, until
 *    Cloudinary confirms the file is gone (one it no longer has counts as
 *    gone); then the entry leaves the ledger. A file that gained a reference
 *    while `destroying` is kept as `lost`, reported, and never destroyed again.
 *
 * What remains: a document whose trigger never runs within the reservation
 * window is caught only by the look at the document named in `detachedFrom`,
 * and a pending file has no such document to look at.
 *
 * Nothing here imports firebase-admin or firebase-functions: Firestore, the
 * Cloudinary call and the clock come in as arguments, so the tests can stub
 * them.
 */
import { MEDIA_ASSETS, MEDIA_USAGE } from './mediaSigning.js'
import { isOverCap, reconcileRef, refOfEntry, refsOf } from './mediaRefs.js'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export const PENDING_GRACE_DAYS = 7
export const DETACHED_GRACE_DAYS = 30

// How long a reservation must have stood before the file may be destroyed.
// Under a day, so the nightly run always qualifies the previous night's
// reservations; over any jitter in the schedule, so it never qualifies its own.
export const RESERVATION_MS = 12 * HOUR_MS

// Cloudinary's Admin API deletes at most 100 public ids per call.
export const DESTROY_BATCH = 100

// Per state and run. What is left over waits for the next day.
export const PURGE_PAGE = 500

const millis = (value) => {
  if (value == null) return NaN
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return Number(value)
}

/**
 * Is this ledger entry due for deletion at `now`? The one test, used for the
 * query's results and again inside the transaction before each delete.
 */
export function isDue(entry, now) {
  // A file from before the ledger is never the clean-up's to delete
  // (functions/mediaRefs.js says why).
  if (!entry || entry.legacy || (Array.isArray(entry.refs) && entry.refs.length > 0)) return false
  if (entry.state === 'pending') return millis(entry.createdAt) <= now - PENDING_GRACE_DAYS * DAY_MS
  if (entry.state === 'detached') return millis(entry.detachedAt) <= now - DETACHED_GRACE_DAYS * DAY_MS
  // `deleting`, `destroying` and `lost` are the clean-up's own states and are
  // not due: a reservation is not reserved twice, and a lost file is not
  // destroyed again.
  return false
}

/**
 * Destroying files on Cloudinary, through its Admin API: one call per resource
 * type and hundred files. A file Cloudinary no longer has counts as gone.
 *
 * @param {{ fetch: typeof fetch, cloudName: string, apiKey: string, secret: string }} config
 * @returns {(resourceType: string, publicIds: string[]) => Promise<Set<string>>} the ids that are gone
 */
export function cloudinaryDestroyer({ fetch, cloudName, apiKey, secret }) {
  const auth = Buffer.from(`${apiKey}:${secret}`).toString('base64')
  return async (resourceType, publicIds) => {
    const query = new URLSearchParams()
    for (const id of publicIds) query.append('public_ids[]', id)
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/resources/${encodeURIComponent(resourceType)}/upload?${query}`,
      { method: 'DELETE', headers: { Authorization: `Basic ${auth}` } },
    )
    if (!response.ok) throw new Error(`Cloudinary refused the delete (${response.status})`)
    const body = await response.json()
    const gone = new Set()
    for (const [id, result] of Object.entries(body?.deleted ?? {})) {
      if (result === 'deleted' || result === 'not_found') gone.add(id)
    }
    return gone
  }
}

const entriesOf = (snaps) => snaps.flatMap((snap) => snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))

async function dueEntries(db, now) {
  const pendingCutoff = new Date(now - PENDING_GRACE_DAYS * DAY_MS)
  const detachedCutoff = new Date(now - DETACHED_GRACE_DAYS * DAY_MS)
  const assets = db.collection(MEDIA_ASSETS)
  const snaps = await Promise.all([
    assets.where('state', '==', 'pending').where('createdAt', '<=', pendingCutoff).limit(PURGE_PAGE).get(),
    assets.where('state', '==', 'detached').where('detachedAt', '<=', detachedCutoff).limit(PURGE_PAGE).get(),
  ])
  return entriesOf(snaps).filter((entry) => isDue(entry, now))
}

// Reservations that have stood long enough (a composite index on state and
// deletingSince), and every entry whose destroy is not confirmed yet.
async function destroyableEntries(db, now) {
  const cutoff = new Date(now - RESERVATION_MS)
  const assets = db.collection(MEDIA_ASSETS)
  const [deleting, destroying] = await Promise.all([
    assets.where('state', '==', 'deleting').where('deletingSince', '<=', cutoff).limit(PURGE_PAGE).get(),
    assets.where('state', '==', 'destroying').limit(PURGE_PAGE).get(),
  ])
  return { deleting: entriesOf([deleting]), destroying: entriesOf([destroying]) }
}

/**
 * Does the document that let this file go hold it again after all? The
 * ledger is only as right as the triggers that keep it, and a trigger that
 * failed for good, or one from before they read the document itself
 * (functions/mediaRefs.js), can have left a file "detached" that is still
 * shown. One look at that document before deleting costs a read; a wrong
 * delete costs a family photo.
 */
async function heldWhereItWasLetGo(db, entry) {
  const [collection, docId, ...rest] = typeof entry.detachedFrom === 'string' ? entry.detachedFrom.split('/') : []
  if (!collection || !docId || rest.length > 0) return false
  const source = await db.collection(collection).doc(docId).get()
  if (!source.exists) return false
  // A document too big to trust cannot show that it lets the file go, so it
  // counts as holding it: a file kept by mistake costs space, a wrong delete a photo.
  if (isOverCap(source.data())) return true
  return refsOf(source.data()).has(refOfEntry(entry))
}

/**
 * Keep a file the document that let it go holds after all: put it back in the
 * ledger (which also cancels a reservation) and log it. True if it was held.
 */
async function keepIfHeld(db, entry, now) {
  if (!(await heldWhereItWasLetGo(db, entry))) return false
  console.error('[media] a file the ledger called detached is still in use; kept:', entry.id)
  const [collection, docId] = entry.detachedFrom.split('/')
  await reconcileRef(db, () => now, refOfEntry(entry), collection, docId)
  return true
}

/**
 * Step one: reserve a due file. Read again first, so a file picked up since
 * the query is kept; the transaction then checks once more and writes.
 * `deletingFrom` and the dates stay, so a cancelled reservation can go back.
 */
async function reserve(db, entry, now) {
  const ref = db.collection(MEDIA_ASSETS).doc(entry.id)
  const snap = await ref.get()
  if (!snap.exists || !isDue(snap.data(), now)) return false
  if (await keepIfHeld(db, { id: entry.id, ...snap.data() }, now)) return false
  return db.runTransaction(async (tx) => {
    const current = await tx.get(ref)
    if (!current.exists || !isDue(current.data(), now)) return false
    tx.update(ref, { state: 'deleting', deletingSince: new Date(now), deletingFrom: current.data().state })
    return true
  })
}

/**
 * Step two: the point of no return. Only an entry still `deleting`, without
 * references and reserved long enough, becomes `destroying`; a trigger that
 * attached the file in the meantime has already cancelled the reservation.
 */
async function commitToDestroy(db, entry, now) {
  if (await keepIfHeld(db, entry, now)) return false
  const ref = db.collection(MEDIA_ASSETS).doc(entry.id)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return false
    const current = snap.data()
    if (current.state !== 'deleting' || (Array.isArray(current.refs) && current.refs.length > 0)) return false
    if (!(millis(current.deletingSince) <= now - RESERVATION_MS)) return false
    tx.update(ref, { state: 'destroying', destroyingSince: new Date(now) })
    return true
  })
}

/**
 * Remove a destroyed file from the ledger and its size from the family's
 * usage, in one transaction. A file that gained a reference after the point of
 * no return is gone, so the entry is kept as `lost` and reported instead.
 */
async function forget(db, id, now) {
  const ref = db.collection(MEDIA_ASSETS).doc(id)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return 'gone'
    const entry = snap.data()
    if (entry.state !== 'destroying') return 'gone'
    if (Array.isArray(entry.refs) && entry.refs.length > 0) {
      tx.update(ref, { state: 'lost', lostAt: new Date(now) })
      return 'raced'
    }

    // A file with a size gives it back; one whose size was never known (an
    // upload that never happened, as a rule) gives back the estimate it was
    // counted at. An entry from before either was counted gives back nothing.
    const sized = typeof entry.bytes === 'number' && Number.isFinite(entry.bytes)
    const unsized = entry.bytes === null
    let usage = null
    let usageRef = null
    if ((sized || unsized) && entry.familyId) {
      usageRef = db.collection(MEDIA_USAGE).doc(entry.familyId)
      const usageSnap = await tx.get(usageRef)
      usage = usageSnap.exists ? usageSnap.data() : null
    }

    tx.delete(ref)
    if (usage) {
      tx.set(usageRef, {
        bytes: Math.max(0, (Number(usage.bytes) || 0) - (sized ? entry.bytes : 0)),
        files: Math.max(0, (Number(usage.files) || 0) - (sized ? 1 : 0)),
        unsized: Math.max(0, (Number(usage.unsized) || 0) - (unsized ? 1 : 0)),
      })
    }
    return 'forgotten'
  })
}

const byResourceType = (entries) => {
  const byType = new Map()
  for (const entry of entries) {
    if (typeof entry.publicId !== 'string' || !entry.resourceType) continue
    const list = byType.get(entry.resourceType) ?? []
    list.push(entry)
    byType.set(entry.resourceType, list)
  }
  return byType
}

/** Destroy entries that are `destroying`, forget the confirmed ones. */
async function destroyAndForget(db, destroy, entries, now, stats) {
  for (const [resourceType, group] of byResourceType(entries)) {
    for (let i = 0; i < group.length; i += DESTROY_BATCH) {
      const batch = group.slice(i, i + DESTROY_BATCH)
      let gone
      try {
        gone = await destroy(resourceType, batch.map((entry) => entry.publicId))
      } catch (error) {
        // The entries stay `destroying`, so every later run asks again.
        console.error('[media] destroy failed; will be retried', error)
        stats.failed += batch.length
        continue
      }

      for (const entry of batch) {
        if (!gone.has(entry.publicId)) {
          console.error('[media] destroy not confirmed; will be retried:', entry.id)
          stats.failed++
          continue
        }
        const result = await forget(db, entry.id, now)
        if (result === 'raced') {
          stats.raced++
          console.error('[media] a file was picked up again while it was being deleted; kept as lost:', entry.id)
        } else if (result === 'forgotten') {
          stats.deleted++
        }
      }
    }
  }
}

/**
 * One run of the clean-up: destroy what an earlier run reserved, then reserve
 * what is due now. In that order, so a file is never reserved and destroyed in
 * the same run.
 *
 * @param {{ db: any, destroy: (resourceType: string, publicIds: string[]) => Promise<Set<string>>, dryRun: boolean, now?: () => number }} deps
 * @returns {Promise<{ due: number, reserved: number, deleted: number, kept: number, failed: number, raced: number, dryRun: boolean, wouldDelete?: string[], inFlight?: number }>}
 */
export async function purgeMedia({ db, destroy, dryRun, now = Date.now }) {
  const at = now()
  const due = await dueEntries(db, at)
  const stats = { due: due.length, reserved: 0, deleted: 0, kept: 0, failed: 0, raced: 0, dryRun }

  if (dryRun) {
    // The same last look as a real run takes, so the report the switch to a
    // real run is judged by does not list a file a document still shows.
    stats.wouldDelete = []
    for (const entry of due) {
      if (await heldWhereItWasLetGo(db, entry)) stats.kept++
      else stats.wouldDelete.push(entry.publicId)
    }
    // Reservations and destroys an earlier real run left: a dry run neither
    // continues nor cancels them, it only says they are there.
    const assets = db.collection(MEDIA_ASSETS)
    const [deleting, destroying] = await Promise.all([
      assets.where('state', '==', 'deleting').limit(PURGE_PAGE).get(),
      assets.where('state', '==', 'destroying').limit(PURGE_PAGE).get(),
    ])
    stats.inFlight = deleting.docs.length + destroying.docs.length
    return stats
  }

  const earlier = await destroyableEntries(db, at)
  const destroying = [...earlier.destroying]
  for (const entry of earlier.deleting) {
    if (await commitToDestroy(db, entry, at)) destroying.push(entry)
    else stats.kept++
  }
  await destroyAndForget(db, destroy, destroying, at, stats)

  for (const entry of due) {
    if (typeof entry.publicId !== 'string' || !entry.resourceType) continue
    if (await reserve(db, entry, at)) stats.reserved++
    else stats.kept++
  }
  return stats
}
