// @vitest-environment node
/**
 * The daily size lookup — functions/mediaSizes.js.
 *
 * What it writes is what the storage quota reads once the estimate is gone, so
 * each file must be counted exactly once, a file Cloudinary does not have yet
 * must keep its estimate, and a refused lookup must change nothing.
 */
import { describe, it, expect, vi } from 'vitest'
import { cloudinarySizer, syncMediaSizes } from '../../functions/mediaSizes.js'
import { MEDIA_ASSETS, MEDIA_USAGE } from '../../functions/mediaSigning.js'
import { fakeAdminFirestore } from './fakeAdminFirestore.js'

const hex = (c) => c.repeat(32)
const pid = (c) => `kaydo/fam-1/${hex(c)}`

const entry = (c, extra = {}) => [
  `${MEDIA_ASSETS}/${hex(c)}`,
  { familyId: 'fam-1', publicId: pid(c), resourceType: 'raw', state: 'attached', refs: ['memories/m1'], bytes: null, ...extra },
]

function setup(entries, usage = { bytes: 100, files: 1, unsized: 3 }) {
  return fakeAdminFirestore(Object.fromEntries([...entries, [`${MEDIA_USAGE}/fam-1`, usage]]))
}

const usageOf = (db) => db.collectionData(MEDIA_USAGE)['fam-1']
const assetOf = (db, c) => db.collectionData(MEDIA_ASSETS)[hex(c)]

describe('syncMediaSizes', () => {
  it('puts each size on its entry and swaps the estimate for it in the family’s usage', async () => {
    const db = setup([entry('a'), entry('b'), entry('c')])
    const lookup = vi.fn(async () => new Map([[pid('a'), 40], [pid('b'), 60]]))

    const stats = await syncMediaSizes({ db, lookup })

    expect(stats).toEqual({ unsized: 3, recorded: 2, missing: 1, failed: 0 })
    expect(lookup).toHaveBeenCalledWith('raw', [pid('a'), pid('b'), pid('c')])
    expect(assetOf(db, 'a').bytes).toBe(40)
    // Not on Cloudinary (yet): it keeps its estimate.
    expect(assetOf(db, 'c').bytes).toBe(null)
    expect(usageOf(db)).toEqual({ bytes: 200, files: 3, unsized: 1 })
  })

  it('counts a file once, however often it is looked up', async () => {
    const db = setup([entry('a')], { bytes: 0, files: 0, unsized: 1 })
    const lookup = async () => new Map([[pid('a'), 40]])
    await syncMediaSizes({ db, lookup })
    const again = await syncMediaSizes({ db, lookup })
    expect(again.unsized).toBe(0)
    expect(usageOf(db)).toEqual({ bytes: 40, files: 1, unsized: 0 })
  })

  it('asks for each resource type on its own', async () => {
    const db = setup([entry('a'), entry('b', { resourceType: 'image', publicId: `kaydo/public/fam-1/${hex('b')}` })])
    const lookup = vi.fn(async () => new Map())
    await syncMediaSizes({ db, lookup })
    expect(lookup.mock.calls.map(([type]) => type).sort()).toEqual(['image', 'raw'])
  })

  it('leaves everything as it was when Cloudinary refuses, so the next run asks again', async () => {
    const db = setup([entry('a')])
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const stats = await syncMediaSizes({ db, lookup: async () => { throw new Error('420') } })
    error.mockRestore()
    expect(stats.failed).toBe(1)
    expect(assetOf(db, 'a').bytes).toBe(null)
    expect(usageOf(db)).toEqual({ bytes: 100, files: 1, unsized: 3 })
  })

  it('leaves alone entries that have a size, and those from before the estimate', async () => {
    const db = setup([entry('a', { bytes: 10 }), entry('b', { bytes: undefined })])
    const lookup = vi.fn(async () => new Map())
    expect((await syncMediaSizes({ db, lookup })).unsized).toBe(0)
    expect(lookup).not.toHaveBeenCalled()
  })
})

describe('cloudinarySizer', () => {
  it('asks the Admin API for the files by public id, and reads their sizes', async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ resources: [{ public_id: 'kaydo/f/a', bytes: 12 }, { public_id: 'kaydo/f/b', bytes: 'x' }] }),
    }))
    const sizes = await cloudinarySizer({ fetch, cloudName: 'demo', apiKey: 'key', secret: 'secret' })('raw', ['kaydo/f/a', 'kaydo/f/b'])

    expect([...sizes]).toEqual([['kaydo/f/a', 12]])
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.cloudinary.com/v1_1/demo/resources/raw/upload?max_results=100&public_ids%5B%5D=kaydo%2Ff%2Fa&public_ids%5B%5D=kaydo%2Ff%2Fb')
    expect(init.headers.Authorization).toBe(`Basic ${btoa('key:secret')}`)
  })

  it('throws when Cloudinary refuses', async () => {
    const sizer = cloudinarySizer({ fetch: async () => ({ ok: false, status: 401 }), cloudName: 'demo', apiKey: 'k', secret: 's' })
    await expect(sizer('raw', ['x'])).rejects.toThrow('401')
  })
})
