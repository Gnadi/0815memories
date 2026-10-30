/**
 * The sizes of uploaded files, asked of Cloudinary once a day.
 *
 * signUpload records a file before it exists, so the ledger cannot know its
 * size, and the storage quota counts every such file at the most a file can
 * weigh (checkQuota in functions/mediaSigning.js). This puts the real size in:
 * it lists the ledger entries still without one, asks Cloudinary's Admin API
 * for those files, a hundred at a time, and writes each size onto its entry and
 * into its family's usage, where it replaces the estimate.
 *
 * It replaced a notification Cloudinary sent after each upload. That needed a
 * public endpoint and agreement between two signatures, and it is a day's
 * delay that costs nothing here, because the quota never relied on it.
 *
 * A file Cloudinary does not have yet is left as it is: its upload may still
 * be running, or never have happened, in which case the clean-up removes the
 * entry and its estimate after a week (functions/mediaPurge.js).
 *
 * Nothing here imports firebase-admin or firebase-functions: Firestore and the
 * Cloudinary call come in as arguments, so the tests can stub them.
 */
import { MEDIA_ASSETS, MEDIA_USAGE } from './mediaSigning.js'

// Cloudinary's Admin API takes at most a hundred public ids per call.
export const LOOKUP_BATCH = 100

// Per run. What is left over waits for the next day.
export const SIZE_PAGE = 1000

/**
 * Looking files up on Cloudinary by public id.
 *
 * @param {{ fetch: typeof fetch, cloudName: string, apiKey: string, secret: string }} config
 * @returns {(resourceType: string, publicIds: string[]) => Promise<Map<string, number>>} the size of each file found
 */
export function cloudinarySizer({ fetch, cloudName, apiKey, secret }) {
  const auth = Buffer.from(`${apiKey}:${secret}`).toString('base64')
  return async (resourceType, publicIds) => {
    const query = new URLSearchParams({ max_results: String(LOOKUP_BATCH) })
    for (const id of publicIds) query.append('public_ids[]', id)
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/resources/${encodeURIComponent(resourceType)}/upload?${query}`,
      { headers: { Authorization: `Basic ${auth}` } },
    )
    if (!response.ok) throw new Error(`Cloudinary refused the lookup (${response.status})`)
    const body = await response.json()
    const sizes = new Map()
    for (const resource of Array.isArray(body?.resources) ? body.resources : []) {
      const bytes = Number(resource?.bytes)
      if (typeof resource?.public_id === 'string' && Number.isFinite(bytes) && bytes >= 0) {
        sizes.set(resource.public_id, bytes)
      }
    }
    return sizes
  }
}

/**
 * Put one file's size on its entry and into its family's usage, where it
 * takes the place of the estimate. Only while the entry still has no size, so
 * a file is counted once however often it is looked up.
 */
async function recordSize(db, id, bytes) {
  const ref = db.collection(MEDIA_ASSETS).doc(id)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const entry = snap.exists ? snap.data() : null
    if (!entry || entry.bytes !== null || !entry.familyId) return false

    const usageRef = db.collection(MEDIA_USAGE).doc(entry.familyId)
    const usage = await tx.get(usageRef)
    const current = usage.exists ? usage.data() : {}

    tx.update(ref, { bytes })
    tx.set(usageRef, {
      bytes: (Number(current.bytes) || 0) + bytes,
      files: (Number(current.files) || 0) + 1,
      unsized: Math.max(0, (Number(current.unsized) || 0) - 1),
    })
    return true
  })
}

/**
 * One run: every entry still without a size, looked up and recorded.
 *
 * @param {{ db: any, lookup: ReturnType<typeof cloudinarySizer> }} deps
 * @returns {Promise<{ unsized: number, recorded: number, missing: number, failed: number }>}
 */
export async function syncMediaSizes({ db, lookup }) {
  const snapshot = await db.collection(MEDIA_ASSETS).where('bytes', '==', null).limit(SIZE_PAGE).get()
  const entries = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
  const stats = { unsized: entries.length, recorded: 0, missing: 0, failed: 0 }

  const byType = new Map()
  for (const entry of entries) {
    if (typeof entry.publicId !== 'string' || !entry.resourceType) continue
    const list = byType.get(entry.resourceType) ?? []
    list.push(entry)
    byType.set(entry.resourceType, list)
  }

  for (const [resourceType, list] of byType) {
    for (let i = 0; i < list.length; i += LOOKUP_BATCH) {
      const batch = list.slice(i, i + LOOKUP_BATCH)
      let sizes
      try {
        sizes = await lookup(resourceType, batch.map((entry) => entry.publicId))
      } catch (error) {
        // Nothing changed, so the next run asks again.
        console.error('[media] size lookup failed', error)
        stats.failed += batch.length
        continue
      }
      for (const entry of batch) {
        if (!sizes.has(entry.publicId)) {
          stats.missing++
          continue
        }
        if (await recordSize(db, entry.id, sizes.get(entry.publicId))) stats.recorded++
      }
    }
  }
  return stats
}
