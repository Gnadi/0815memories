// @vitest-environment node
/**
 * The inventory of files from before the ledger — functions/mediaInventory.js.
 *
 * For those files it decides nothing irreversible: it counts the ones families
 * claimed into their usage, once, and reports the rest. The one thing it
 * deletes is a file stored as another kind than its upload was signed for,
 * and only on the ledger's word.
 */
import { describe, it, expect, vi } from 'vitest'
import { cloudinaryLister, inventoryLegacyMedia, MEDIA_REPORTS } from '../../functions/mediaInventory.js'
import { MEDIA_ASSETS, MEDIA_USAGE } from '../../functions/mediaSigning.js'
import { fakeAdminFirestore } from './fakeAdminFirestore.js'

const NOW = Date.parse('2026-10-26T05:15:00Z')
const CLAIMED = 'legacy~raw~kaydo%2Fencrypted%2Fold1.dat'

function setup() {
  return fakeAdminFirestore({
    [`${MEDIA_ASSETS}/${CLAIMED}`]: { familyId: 'fam-1', publicId: 'kaydo/encrypted/old1.dat', resourceType: 'raw', legacy: true, state: 'attached', refs: ['memories/m1'] },
    [`${MEDIA_USAGE}/fam-1`]: { bytes: 100, files: 1 },
    'families/fam-1': { mediaIndexedAt: new Date(NOW - 1000) },
    'families/fam-2': { familyName: 'Not yet' },
  })
}

// Two pages of raw files, one image page, no videos.
const pages = {
  'raw:': { resources: [{ public_id: 'kaydo/encrypted/old1.dat', bytes: 40 }, { public_id: 'kaydo/encrypted/lost.dat', bytes: 7 }], next: 'p2' },
  'raw:p2': { resources: [{ public_id: `kaydo/fam-1/${'a'.repeat(32)}`, bytes: 999 }] },
  'image:': { resources: [{ public_id: 'kaydo/header', bytes: 3 }] },
  'video:': { resources: [] },
}
const list = vi.fn(async (type, cursor) => pages[`${type}:${cursor ?? ''}`])

describe('inventoryLegacyMedia', () => {
  it('counts claimed files into their family once, and reports the unclaimed ones', async () => {
    const db = setup()
    const report = await inventoryLegacyMedia({ db, list, now: () => NOW })

    // The file signUpload made is the ledger's business, not the inventory's.
    expect(report).toMatchObject({
      files: 3,
      bytes: 50,
      claimed: 1,
      claimedBytes: 40,
      newlyCounted: 1,
      unclaimed: 2,
      unclaimedBytes: 10,
      unclaimedSample: ['raw/kaydo/encrypted/lost.dat', 'image/kaydo/header'],
      familiesNotIndexed: 1,
    })
    expect(db.collectionData(MEDIA_USAGE)['fam-1']).toEqual({ bytes: 140, files: 2, unsized: 0 })
    expect(db.collectionData(MEDIA_ASSETS)[CLAIMED].bytes).toBe(40)
    expect(db.collectionData(MEDIA_REPORTS)['2026-10-26']).toMatchObject({ unclaimed: 2, createdAt: new Date(NOW) })

    // A second run counts nothing twice.
    const again = await inventoryLegacyMedia({ db, list, now: () => NOW })
    expect(again.newlyCounted).toBe(0)
    expect(db.collectionData(MEDIA_USAGE)['fam-1']).toEqual({ bytes: 140, files: 2, unsized: 0 })
  })

  it('deletes nothing', async () => {
    const db = setup()
    const before = Object.keys(db.collectionData(MEDIA_ASSETS))
    await inventoryLegacyMedia({ db, list, now: () => NOW })
    expect(Object.keys(db.collectionData(MEDIA_ASSETS))).toEqual(before)
  })
})

describe('files stored as another kind than signed', () => {
  // Cloudinary leaves resource_type out of the signature, so one signature for
  // a raw file also stores an image and a video under the same id.
  const ID = `kaydo/fam-1/${'a'.repeat(32)}`
  const ORPHAN = `kaydo/fam-1/${'b'.repeat(32)}`
  const signedPages = {
    'raw:': { resources: [{ public_id: ID, bytes: 10 }] },
    'image:': { resources: [{ public_id: ID, bytes: 500 }, { public_id: ORPHAN, bytes: 70 }] },
    'video:': { resources: [{ public_id: ID, bytes: 9000 }] },
  }
  const listSigned = async (type, cursor) => signedPages[`${type}:${cursor ?? ''}`]
  const withEntry = () => fakeAdminFirestore({
    [`${MEDIA_ASSETS}/${'a'.repeat(32)}`]: { familyId: 'fam-1', publicId: ID, resourceType: 'raw', state: 'attached', refs: ['memories/m1'] },
  })
  const destroyAll = () => vi.fn(async (_type, ids) => new Set(ids))

  it('deletes them, and leaves the file the ledger knows', async () => {
    const db = withEntry()
    const destroy = destroyAll()
    const report = await inventoryLegacyMedia({ db, list: listSigned, destroy, dryRun: false, now: () => NOW })

    expect(report).toMatchObject({ misfiled: 2, misfiledBytes: 9500, misfiledDeleted: 2, signedUnknown: 1 })
    expect(destroy.mock.calls).toEqual([['image', [ID]], ['video', [ID]]])
    expect(Object.keys(db.collectionData(MEDIA_ASSETS))).toEqual(['a'.repeat(32)])
  })

  it('only reports them while it is a dry run, or without a way to delete', async () => {
    const destroy = destroyAll()
    const dry = await inventoryLegacyMedia({ db: withEntry(), list: listSigned, destroy, now: () => NOW })
    expect(dry).toMatchObject({ misfiled: 2, misfiledDeleted: 0, misfiledSample: [`image/${ID}`, `video/${ID}`] })
    expect(destroy).not.toHaveBeenCalled()

    const none = await inventoryLegacyMedia({ db: withEntry(), list: listSigned, dryRun: false, now: () => NOW })
    expect(none).toMatchObject({ misfiled: 2, misfiledDeleted: 0 })
  })

  it('deletes nothing the ledger does not know, however the id looks', async () => {
    // A lost ledger must not turn the inventory into deleting every file.
    const destroy = destroyAll()
    const report = await inventoryLegacyMedia({ db: fakeAdminFirestore(), list: listSigned, destroy, dryRun: false, now: () => NOW })
    expect(report).toMatchObject({ misfiled: 0, signedUnknown: 4 })
    expect(destroy).not.toHaveBeenCalled()
  })

  it('does not take an entry for another id as proof', async () => {
    const db = fakeAdminFirestore({
      [`${MEDIA_ASSETS}/${'a'.repeat(32)}`]: { familyId: 'fam-2', publicId: `kaydo/fam-2/${'a'.repeat(32)}`, resourceType: 'raw' },
    })
    const destroy = destroyAll()
    const report = await inventoryLegacyMedia({ db, list: listSigned, destroy, dryRun: false, now: () => NOW })
    expect(report.misfiled).toBe(0)
    expect(destroy).not.toHaveBeenCalled()
  })

  it('leaves a refused delete for the next run', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const report = await inventoryLegacyMedia({
      db: withEntry(), list: listSigned, dryRun: false, now: () => NOW,
      destroy: vi.fn(async () => { throw new Error('503') }),
    })
    error.mockRestore()
    expect(report).toMatchObject({ misfiled: 2, misfiledDeleted: 0 })
  })
})

describe('cloudinaryLister', () => {
  it('lists the files under kaydo/, a page at a time', async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ resources: [{ public_id: 'kaydo/a' }], next_cursor: 'c2' }) }))
    const page = await cloudinaryLister({ fetch, cloudName: 'demo', apiKey: 'key', secret: 'secret' })('raw', 'c1')
    expect(page).toEqual({ resources: [{ public_id: 'kaydo/a' }], next: 'c2' })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.cloudinary.com/v1_1/demo/resources/raw/upload?prefix=kaydo%2F&max_results=500&next_cursor=c1')
    expect(init.headers.Authorization).toBe(`Basic ${btoa('key:secret')}`)
  })

  it('throws when Cloudinary refuses', async () => {
    const lister = cloudinaryLister({ fetch: async () => ({ ok: false, status: 420 }), cloudName: 'demo', apiKey: 'k', secret: 's' })
    await expect(lister('raw')).rejects.toThrow('420')
  })
})
