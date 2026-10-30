/**
 * The inventory of files from before the ledger — phase 5 of
 * docs/plan-media-lifecycle.md.
 *
 * Those files were uploaded without a family tag into folders all families
 * shared, so Cloudinary cannot say whose they are. Documents can: once a
 * family's admin has run the backfill (src/services/mediaIndex.js), every old
 * file its documents use has a `legacy` entry in the ledger. This compares the
 * account against that:
 *
 * - a file with an entry is counted, once, in its family's usage, which is
 *   how old files come to count towards the storage quota;
 * - a file without one is used by no document of a family that has run the
 *   backfill. The report says how many there are, how large, and how many
 *   families have not run it yet — while any have not, an unclaimed file may
 *   still be theirs.
 *
 * Nothing here deletes anything. Whether unclaimed files go is the operator's
 * call, made in Cloudinary, once every family has been through the backfill.
 *
 * Nothing here imports firebase-admin or firebase-functions, so the tests can
 * hand in stand-ins.
 */
import { MEDIA_ASSETS, MEDIA_USAGE } from './mediaSigning.js'
import { ledgerIdOf } from './mediaRefs.js'

export const MEDIA_REPORTS = 'mediaReports'
const RESOURCE_TYPES = ['raw', 'image', 'video']
const SIGNED_ID = /^kaydo\/(?:public\/)?[A-Za-z0-9_-]{1,100}\/[0-9a-f]{32}$/

// How many unclaimed public ids the report lists by name. The counts cover
// all of them.
export const REPORT_SAMPLE = 50

/**
 * Listing the account's files under `kaydo/` through Cloudinary's Admin API,
 * a page of up to 500 at a time.
 *
 * @param {{ fetch: typeof fetch, cloudName: string, apiKey: string, secret: string }} config
 * @returns {(resourceType: string, cursor?: string) => Promise<{ resources: Array<{ public_id: string, bytes: number }>, next?: string }>}
 */
export function cloudinaryLister({ fetch, cloudName, apiKey, secret }) {
  const auth = Buffer.from(`${apiKey}:${secret}`).toString('base64')
  return async (resourceType, cursor) => {
    const query = new URLSearchParams({ prefix: 'kaydo/', max_results: '500' })
    if (cursor) query.set('next_cursor', cursor)
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/resources/${encodeURIComponent(resourceType)}/upload?${query}`,
      { headers: { Authorization: `Basic ${auth}` } },
    )
    if (!response.ok) throw new Error(`Cloudinary refused the listing (${response.status})`)
    const body = await response.json()
    return { resources: Array.isArray(body?.resources) ? body.resources : [], next: body?.next_cursor || undefined }
  }
}

/** Count a claimed file's size in its family's usage, once. */
async function countOnce(db, ledgerId, bytes) {
  const ref = db.collection(MEDIA_ASSETS).doc(ledgerId)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const entry = snap.exists ? snap.data() : null
    if (!entry || entry.bytes != null || !entry.familyId) return false
    const usageRef = db.collection(MEDIA_USAGE).doc(entry.familyId)
    const usage = await tx.get(usageRef)
    const current = usage.exists ? usage.data() : {}
    tx.update(ref, { bytes })
    tx.set(usageRef, {
      bytes: (Number(current.bytes) || 0) + bytes,
      files: (Number(current.files) || 0) + 1,
      unsized: Number(current.unsized) || 0,
    })
    return true
  })
}

/**
 * One inventory run.
 *
 * @param {{ db: any, list: ReturnType<typeof cloudinaryLister>, now?: () => number }} deps
 */
export async function inventoryLegacyMedia({ db, list, now = Date.now }) {
  const report = {
    files: 0,
    bytes: 0,
    claimed: 0,
    claimedBytes: 0,
    newlyCounted: 0,
    unclaimed: 0,
    unclaimedBytes: 0,
    unclaimedSample: [],
    familiesNotIndexed: 0,
  }

  for (const resourceType of RESOURCE_TYPES) {
    let cursor
    do {
      const page = await list(resourceType, cursor)
      cursor = page.next
      const legacy = page.resources.filter((r) => typeof r.public_id === 'string' && !SIGNED_ID.test(r.public_id))
      const entries = await Promise.all(legacy.map(async (resource) => {
        const ledgerId = ledgerIdOf(`legacy:${resourceType}/${resource.public_id}`)
        const snap = ledgerId ? await db.collection(MEDIA_ASSETS).doc(ledgerId).get() : null
        return { resource, ledgerId, claimed: !!snap?.exists }
      }))

      for (const { resource, ledgerId, claimed } of entries) {
        const bytes = Number(resource.bytes) || 0
        report.files++
        report.bytes += bytes
        if (claimed) {
          report.claimed++
          report.claimedBytes += bytes
          if (await countOnce(db, ledgerId, bytes)) report.newlyCounted++
        } else {
          report.unclaimed++
          report.unclaimedBytes += bytes
          if (report.unclaimedSample.length < REPORT_SAMPLE) {
            report.unclaimedSample.push(`${resourceType}/${resource.public_id}`)
          }
        }
      }
    } while (cursor)
  }

  const families = await db.collection('families').select('mediaIndexedAt').get()
  report.familiesNotIndexed = families.docs.filter((d) => !d.data().mediaIndexedAt).length

  await db.collection(MEDIA_REPORTS).doc(new Date(now()).toISOString().slice(0, 10)).set({
    ...report,
    createdAt: new Date(now()),
  })
  return report
}
