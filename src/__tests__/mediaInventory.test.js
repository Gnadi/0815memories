// @vitest-environment node
/**
 * The inventory of files from before the ledger — functions/mediaInventory.js.
 *
 * It decides nothing irreversible: it counts the files families claimed into
 * their usage, once, and reports the rest. These hold it to that.
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
