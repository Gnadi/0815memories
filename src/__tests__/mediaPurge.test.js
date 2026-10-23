// @vitest-environment node
/**
 * Deleting the files nothing uses — functions/mediaPurge.js.
 *
 * A deleted photo cannot be brought back, so most of these are about what is
 * kept: files still held by a document, files not old enough yet, files
 * picked up again at the last moment, and everything while it is a dry run.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  cloudinaryDestroyer,
  isDue,
  purgeMedia,
  DETACHED_GRACE_DAYS,
  PENDING_GRACE_DAYS,
} from '../../functions/mediaPurge.js'
import { MEDIA_ASSETS, MEDIA_USAGE } from '../../functions/mediaSigning.js'
import { fakeAdminFirestore } from './fakeAdminFirestore.js'

const NOW = Date.parse('2026-10-23T04:15:00Z')
const DAY = 24 * 60 * 60 * 1000
const daysAgo = (n) => new Date(NOW - n * DAY)
const hex = (c) => c.repeat(32)

const pending = (c, age, extra = {}) => [
  `${MEDIA_ASSETS}/${hex(c)}`,
  { familyId: 'fam-1', publicId: `kaydo/fam-1/${hex(c)}`, resourceType: 'raw', state: 'pending', refs: [], createdAt: daysAgo(age), ...extra },
]
const detached = (c, age, extra = {}) => [
  `${MEDIA_ASSETS}/${hex(c)}`,
  {
    familyId: 'fam-1',
    publicId: `kaydo/fam-1/${hex(c)}`,
    resourceType: 'raw',
    state: 'detached',
    refs: [],
    createdAt: daysAgo(400),
    detachedAt: daysAgo(age),
    ...extra,
  },
]

const ledger = (db) => db.collectionData(MEDIA_ASSETS)
const destroyAll = () => vi.fn(async (_type, ids) => new Set(ids))
const run = (db, destroy, dryRun = false) => purgeMedia({ db, destroy, dryRun, now: () => NOW })

describe('isDue', () => {
  it('waits a week for a pending file and a month for a detached one', () => {
    expect(isDue(pending('a', PENDING_GRACE_DAYS)[1], NOW)).toBe(true)
    expect(isDue(pending('a', PENDING_GRACE_DAYS - 1)[1], NOW)).toBe(false)
    expect(isDue(detached('a', DETACHED_GRACE_DAYS)[1], NOW)).toBe(true)
    expect(isDue(detached('a', DETACHED_GRACE_DAYS - 1)[1], NOW)).toBe(false)
  })

  it('never takes a file a document holds, or one in any other state', () => {
    expect(isDue(detached('a', 90, { refs: ['memories/m1'] })[1], NOW)).toBe(false)
    expect(isDue(detached('a', 90, { state: 'attached' })[1], NOW)).toBe(false)
    expect(isDue(pending('a', 90, { createdAt: undefined })[1], NOW)).toBe(false)
    expect(isDue(null, NOW)).toBe(false)
  })
})

describe('purgeMedia', () => {
  it('only reports while it is a dry run', async () => {
    const db = fakeAdminFirestore(Object.fromEntries([pending('a', 10), detached('b', 40)]))
    const destroy = destroyAll()
    const stats = await run(db, destroy, true)
    expect(stats).toMatchObject({ due: 2, deleted: 0, dryRun: true })
    expect(stats.wouldDelete.sort()).toEqual([`kaydo/fam-1/${hex('a')}`, `kaydo/fam-1/${hex('b')}`])
    expect(destroy).not.toHaveBeenCalled()
    expect(Object.keys(ledger(db))).toHaveLength(2)
  })

  it('destroys what is due, forgets it, and gives its space back to the family', async () => {
    const db = fakeAdminFirestore(Object.fromEntries([
      pending('a', 10, { bytes: 100 }),
      detached('b', 40, { bytes: 300 }),
      pending('c', 1),
      detached('d', 5),
      [`${MEDIA_ASSETS}/${hex('e')}`, { familyId: 'fam-1', publicId: `kaydo/fam-1/${hex('e')}`, resourceType: 'raw', state: 'attached', refs: ['memories/m1'], createdAt: daysAgo(400) }],
      [`${MEDIA_USAGE}/fam-1`, { bytes: 1000, files: 5 }],
    ]))
    const destroy = destroyAll()
    const stats = await run(db, destroy)

    expect(stats).toMatchObject({ due: 2, deleted: 2, kept: 0, failed: 0, raced: 0 })
    expect(destroy).toHaveBeenCalledWith('raw', [`kaydo/fam-1/${hex('a')}`, `kaydo/fam-1/${hex('b')}`])
    expect(Object.keys(ledger(db)).sort()).toEqual([hex('c'), hex('d'), hex('e')])
    expect(db.collectionData(MEDIA_USAGE)['fam-1']).toEqual({ bytes: 600, files: 3 })
  })

  it('destroys each resource type on its own', async () => {
    const db = fakeAdminFirestore(Object.fromEntries([
      pending('a', 10),
      pending('b', 10, { resourceType: 'image', publicId: `kaydo/public/fam-1/${hex('b')}` }),
    ]))
    const destroy = destroyAll()
    await run(db, destroy)
    expect(destroy.mock.calls.map(([type]) => type).sort()).toEqual(['image', 'raw'])
  })

  it('keeps a file a document picked up again after the query', async () => {
    const db = fakeAdminFirestore(Object.fromEntries([detached('a', 40)]))
    const query = db.collection
    // The query sees it as due; by the time each file is checked, a document holds it.
    db.collection = (name) => {
      const c = query(name)
      return { ...c, doc: (id) => ({ ...c.doc(id), get: async () => ({ exists: true, data: () => ({ ...db.docs.get(`${name}/${id}`), refs: ['memories/m2'] }) }) }) }
    }
    const destroy = destroyAll()
    const stats = await run(db, destroy)
    expect(stats).toMatchObject({ due: 1, kept: 1, deleted: 0 })
    expect(destroy).not.toHaveBeenCalled()
  })

  it('leaves the ledger alone when Cloudinary refuses, so the next run tries again', async () => {
    const db = fakeAdminFirestore(Object.fromEntries([pending('a', 10)]))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const stats = await run(db, vi.fn(async () => { throw new Error('503') }))
    error.mockRestore()
    expect(stats).toMatchObject({ failed: 1, deleted: 0 })
    expect(Object.keys(ledger(db))).toEqual([hex('a')])
  })

  it('keeps the entry of a file Cloudinary did not report as gone', async () => {
    const db = fakeAdminFirestore(Object.fromEntries([pending('a', 10), pending('b', 10)]))
    const stats = await run(db, vi.fn(async () => new Set([`kaydo/fam-1/${hex('a')}`])))
    expect(stats).toMatchObject({ deleted: 1, failed: 1 })
    expect(Object.keys(ledger(db))).toEqual([hex('b')])
  })
})

describe('cloudinaryDestroyer', () => {
  it('asks the Admin API to delete the files, and counts the ones it no longer has as gone', async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ deleted: { 'kaydo/f/a': 'deleted', 'kaydo/f/b': 'not_found', 'kaydo/f/c': 'error' } }),
    }))
    const destroy = cloudinaryDestroyer({ fetch, cloudName: 'demo', apiKey: 'key', secret: 'secret' })
    const gone = await destroy('raw', ['kaydo/f/a', 'kaydo/f/b', 'kaydo/f/c'])

    expect([...gone].sort()).toEqual(['kaydo/f/a', 'kaydo/f/b'])
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.cloudinary.com/v1_1/demo/resources/raw/upload?public_ids%5B%5D=kaydo%2Ff%2Fa&public_ids%5B%5D=kaydo%2Ff%2Fb&public_ids%5B%5D=kaydo%2Ff%2Fc')
    expect(init.method).toBe('DELETE')
    expect(init.headers.Authorization).toBe(`Basic ${btoa('key:secret')}`)
  })

  it('throws when Cloudinary refuses', async () => {
    const destroy = cloudinaryDestroyer({ fetch: async () => ({ ok: false, status: 401 }), cloudName: 'demo', apiKey: 'k', secret: 's' })
    await expect(destroy('raw', ['x'])).rejects.toThrow('401')
  })
})
