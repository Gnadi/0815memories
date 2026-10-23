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
 * - Only files in the ledger are touched. A file the ledger does not know —
 *   everything from before it — is never deleted here.
 * - Each file is checked again, in a transaction, right before it goes. One a
 *   document picked up again since the query is kept.
 * - The grace periods are long: a week for a pending file, because an editor
 *   can stay open over a weekend before it saves; thirty days for a detached
 *   one, time to notice a mistake.
 * - It starts as a dry run that only reports what it would delete.
 *
 * Nothing here imports firebase-admin or firebase-functions: Firestore, the
 * Cloudinary call and the clock come in as arguments, so the tests can stub
 * them.
 */
import { MEDIA_ASSETS, MEDIA_USAGE } from './mediaSigning.js'

const DAY_MS = 24 * 60 * 60 * 1000

export const PENDING_GRACE_DAYS = 7
export const DETACHED_GRACE_DAYS = 30

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
  if (!entry || (Array.isArray(entry.refs) && entry.refs.length > 0)) return false
  if (entry.state === 'pending') return millis(entry.createdAt) <= now - PENDING_GRACE_DAYS * DAY_MS
  if (entry.state === 'detached') return millis(entry.detachedAt) <= now - DETACHED_GRACE_DAYS * DAY_MS
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

async function dueEntries(db, now) {
  const pendingCutoff = new Date(now - PENDING_GRACE_DAYS * DAY_MS)
  const detachedCutoff = new Date(now - DETACHED_GRACE_DAYS * DAY_MS)
  const assets = db.collection(MEDIA_ASSETS)
  const [pending, detached] = await Promise.all([
    assets.where('state', '==', 'pending').where('createdAt', '<=', pendingCutoff).limit(PURGE_PAGE).get(),
    assets.where('state', '==', 'detached').where('detachedAt', '<=', detachedCutoff).limit(PURGE_PAGE).get(),
  ])
  return [...pending.docs, ...detached.docs]
    .map((snap) => ({ id: snap.id, ...snap.data() }))
    .filter((entry) => isDue(entry, now))
}

/** Still due? Read again right before the destroy, so a file picked up since is kept. */
async function stillDue(db, id, now) {
  const snap = await db.collection(MEDIA_ASSETS).doc(id).get()
  return snap.exists && isDue(snap.data(), now)
}

/**
 * Remove a destroyed file from the ledger and its size from the family's
 * usage, in one transaction. Removed only while it is still due: an entry a
 * document picked up in the moment between the check and the destroy is kept
 * and reported, because its file is gone.
 */
async function forget(db, id, now) {
  const ref = db.collection(MEDIA_ASSETS).doc(id)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return 'gone'
    const entry = snap.data()
    if (!isDue(entry, now)) return 'raced'

    const bytes = Number(entry.bytes)
    let usage = null
    let usageRef = null
    if (Number.isFinite(bytes) && entry.familyId) {
      usageRef = db.collection(MEDIA_USAGE).doc(entry.familyId)
      const usageSnap = await tx.get(usageRef)
      usage = usageSnap.exists ? usageSnap.data() : null
    }

    tx.delete(ref)
    if (usage) {
      tx.set(usageRef, {
        bytes: Math.max(0, (Number(usage.bytes) || 0) - bytes),
        files: Math.max(0, (Number(usage.files) || 0) - 1),
      })
    }
    return 'forgotten'
  })
}

/**
 * One run of the clean-up.
 *
 * @param {{ db: any, destroy: (resourceType: string, publicIds: string[]) => Promise<Set<string>>, dryRun: boolean, now?: () => number }} deps
 * @returns {Promise<{ due: number, deleted: number, kept: number, failed: number, raced: number, dryRun: boolean, wouldDelete?: string[] }>}
 */
export async function purgeMedia({ db, destroy, dryRun, now = Date.now }) {
  const at = now()
  const due = await dueEntries(db, at)
  const stats = { due: due.length, deleted: 0, kept: 0, failed: 0, raced: 0, dryRun }

  if (dryRun) {
    stats.wouldDelete = due.map((entry) => entry.publicId)
    return stats
  }

  const byType = new Map()
  for (const entry of due) {
    if (typeof entry.publicId !== 'string' || !entry.resourceType) continue
    const list = byType.get(entry.resourceType) ?? []
    list.push(entry)
    byType.set(entry.resourceType, list)
  }

  for (const [resourceType, entries] of byType) {
    for (let i = 0; i < entries.length; i += DESTROY_BATCH) {
      const checked = []
      for (const entry of entries.slice(i, i + DESTROY_BATCH)) {
        if (await stillDue(db, entry.id, at)) checked.push(entry)
        else stats.kept++
      }
      if (checked.length === 0) continue

      let gone
      try {
        gone = await destroy(resourceType, checked.map((entry) => entry.publicId))
      } catch (error) {
        // Nothing in the ledger changed, so the next run tries these again.
        console.error('[media] destroy failed', error)
        stats.failed += checked.length
        continue
      }

      for (const entry of checked) {
        if (!gone.has(entry.publicId)) {
          stats.failed++
          continue
        }
        const result = await forget(db, entry.id, at)
        if (result === 'raced') {
          stats.raced++
          console.error(`[media] ${entry.publicId} was picked up again while it was being deleted`)
        } else {
          stats.deleted++
        }
      }
    }
  }
  return stats
}
