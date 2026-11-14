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
 * Nothing of that is deleted here. Whether unclaimed files go is the
 * operator's call, made in Cloudinary, once every family has been through the
 * backfill.
 *
 * The one thing this does delete is a file signUpload signed that was stored
 * as another kind than it was signed for. Cloudinary leaves `resource_type`
 * out of what a signature covers, so the signature for one `raw` file also
 * lets a tampered browser store an `image` and a `video` under the same public
 * id. Those two are in no ledger entry's name: they do not count against the
 * family's storage and the daily clean-up never looks for them. This run
 * lists every file in the account anyway, so it is where they are found. The
 * ledger entry is the proof: it says the id is one Kaydo signed, and for
 * which kind. A file with a signed id and no entry at all is only reported —
 * a lost ledger must not turn this into deleting every file there is.
 *
 * Nothing here imports firebase-admin or firebase-functions, so the tests can
 * hand in stand-ins.
 */
import { MEDIA_ASSETS, MEDIA_USAGE } from './mediaSigning.js'
import { ledgerIdOf } from './mediaRefs.js'
import { DESTROY_BATCH, RESOURCE_TYPES } from './mediaPurge.js'

export const MEDIA_REPORTS = 'mediaReports'
const SIGNED_ID = /^kaydo\/(?:public\/)?[A-Za-z0-9_-]{1,100}\/([0-9a-f]{32})$/

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
 * What a listed file with a signed id is: the file its ledger entry stands
 * for, one stored as another kind than was signed ('misfiled'), or one the
 * ledger does not know ('unknown').
 */
async function signedFileStatus(db, resourceType, publicId) {
  const snap = await db.collection(MEDIA_ASSETS).doc(SIGNED_ID.exec(publicId)[1]).get()
  const entry = snap.exists ? snap.data() : null
  if (!entry || entry.publicId !== publicId) return 'unknown'
  return entry.resourceType === resourceType ? 'known' : 'misfiled'
}

/**
 * One inventory run.
 *
 * @param {object} deps
 * @param {any} deps.db
 * @param {ReturnType<typeof cloudinaryLister>} deps.list
 * @param {((resourceType: string, publicIds: string[]) => Promise<Set<string>>)|null} [deps.destroy]
 *   cloudinaryDestroyer, for misfiled files; without it they are only reported
 * @param {boolean} [deps.dryRun]  report misfiled files instead of deleting them
 * @param {() => number} [deps.now]
 */
export async function inventoryLegacyMedia({ db, list, destroy = null, dryRun = true, now = Date.now }) {
  const misfiled = new Map(RESOURCE_TYPES.map((type) => [type, []]))
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
    // Signed ids stored as another kind than signed, and signed ids the
    // ledger does not know (the header says why only the first are deleted).
    misfiled: 0,
    misfiledBytes: 0,
    misfiledDeleted: 0,
    misfiledSample: [],
    signedUnknown: 0,
  }

  for (const resourceType of RESOURCE_TYPES) {
    let cursor
    do {
      const page = await list(resourceType, cursor)
      cursor = page.next
      const named = page.resources.filter((r) => typeof r.public_id === 'string')
      const legacy = named.filter((r) => !SIGNED_ID.test(r.public_id))
      const signed = named.filter((r) => SIGNED_ID.test(r.public_id))
      const statuses = await Promise.all(signed.map((r) => signedFileStatus(db, resourceType, r.public_id)))
      signed.forEach((resource, i) => {
        if (statuses[i] === 'unknown') report.signedUnknown++
        if (statuses[i] !== 'misfiled') return
        report.misfiled++
        report.misfiledBytes += Number(resource.bytes) || 0
        misfiled.get(resourceType).push(resource.public_id)
        if (report.misfiledSample.length < REPORT_SAMPLE) report.misfiledSample.push(`${resourceType}/${resource.public_id}`)
      })
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

  if (destroy && !dryRun) {
    for (const [resourceType, ids] of misfiled) {
      for (let i = 0; i < ids.length; i += DESTROY_BATCH) {
        const batch = ids.slice(i, i + DESTROY_BATCH)
        // A refused delete is left for next week's run, which finds it again.
        const gone = await destroy(resourceType, batch).catch((error) => {
          console.error('[media] could not delete misfiled files', error)
          return new Set()
        })
        report.misfiledDeleted += batch.filter((id) => gone.has(id)).length
      }
    }
  }

  const families = await db.collection('families').select('mediaIndexedAt').get()
  report.familiesNotIndexed = families.docs.filter((d) => !d.data().mediaIndexedAt).length

  await db.collection(MEDIA_REPORTS).doc(new Date(now()).toISOString().slice(0, 10)).set({
    ...report,
    createdAt: new Date(now()),
  })
  return report
}
