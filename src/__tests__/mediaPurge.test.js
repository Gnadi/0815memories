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
  destroyUnderOtherTypes,
  isDue,
  purgeMedia,
  DETACHED_GRACE_DAYS,
  PENDING_GRACE_DAYS,
  RESERVATION_MS,
} from '../../functions/mediaPurge.js'
import { MEDIA_ASSETS, MEDIA_USAGE } from '../../functions/mediaSigning.js'
import { MAX_MEDIA_REFS, trackMediaRefs } from '../../functions/mediaRefs.js'
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
const run = (db, destroy, dryRun = false, at = NOW) => purgeMedia({ db, destroy, dryRun, now: () => at })
// A file goes in two runs a day apart: the first reserves it, the second
// destroys it. `second` is the answer of the run that destroys.
const NEXT = NOW + DAY
const twice = async (db, destroy) => {
  const first = await run(db, vi.fn())
  return { first, second: await run(db, destroy, false, NEXT) }
}

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
    // A file from before the ledger, whatever state it is in.
    expect(isDue(detached('a', 90, { legacy: true })[1], NOW)).toBe(false)
  })

  it('does not take a file the clean-up has reserved, is destroying or has lost', () => {
    for (const state of ['deleting', 'destroying', 'lost']) {
      expect(isDue(detached('a', 90, { state, deletingSince: daysAgo(90) })[1], NOW)).toBe(false)
    }
  })
})

describe('purgeMedia', () => {
  it('only reports while it is a dry run', async () => {
    const db = fakeAdminFirestore(Object.fromEntries([pending('a', 10), detached('b', 40)]))
    const destroy = destroyAll()
    const stats = await run(db, destroy, true)
    expect(stats).toMatchObject({ due: 2, reserved: 0, deleted: 0, dryRun: true, inFlight: 0 })
    expect(stats.wouldDelete.sort()).toEqual([`kaydo/fam-1/${hex('a')}`, `kaydo/fam-1/${hex('b')}`])
    expect(destroy).not.toHaveBeenCalled()
    expect(Object.keys(ledger(db))).toHaveLength(2)
    // A dry run changes nothing in the ledger, not even a reservation.
    expect(ledger(db)[hex('a')].state).toBe('pending')
    expect(ledger(db)[hex('b')].state).toBe('detached')
  })

  it('reports reservations and destroys of earlier runs as in flight, and leaves them alone', async () => {
    const db = fakeAdminFirestore(Object.fromEntries([
      detached('a', 40, { state: 'deleting', deletingSince: new Date(NOW - DAY) }),
      detached('b', 40, { state: 'destroying' }),
      detached('c', 40, { state: 'lost', refs: ['memories/m1'] }),
    ]))
    const destroy = destroyAll()
    const stats = await run(db, destroy, true, NEXT)
    expect(stats).toMatchObject({ due: 0, inFlight: 2, wouldDelete: [] })
    expect(destroy).not.toHaveBeenCalled()
    expect(ledger(db)[hex('a')].state).toBe('deleting')
    expect(ledger(db)[hex('b')].state).toBe('destroying')
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
    const first = await run(db, destroy)

    // The first run only reserves: nothing is destroyed, nothing forgotten.
    expect(first).toMatchObject({ due: 2, reserved: 2, deleted: 0, kept: 0, failed: 0, raced: 0 })
    expect(destroy).not.toHaveBeenCalled()
    expect(ledger(db)[hex('a')]).toMatchObject({ state: 'deleting', deletingSince: new Date(NOW), deletingFrom: 'pending' })
    expect(ledger(db)[hex('b')]).toMatchObject({ state: 'deleting', deletingFrom: 'detached' })
    expect(db.collectionData(MEDIA_USAGE)['fam-1']).toEqual({ bytes: 1000, files: 5 })

    const stats = await run(db, destroy, false, NEXT)
    expect(stats).toMatchObject({ due: 0, reserved: 0, deleted: 2, kept: 0, failed: 0, raced: 0 })
    expect(destroy).toHaveBeenCalledWith('raw', [`kaydo/fam-1/${hex('a')}`, `kaydo/fam-1/${hex('b')}`])
    expect(Object.keys(ledger(db)).sort()).toEqual([hex('c'), hex('d'), hex('e')])
    expect(db.collectionData(MEDIA_USAGE)['fam-1']).toEqual({ bytes: 600, files: 3, unsized: 0 })
  })

  it('gives back the estimate of an upload that never happened', async () => {
    const db = fakeAdminFirestore(Object.fromEntries([
      pending('a', 10, { bytes: null }),
      [`${MEDIA_USAGE}/fam-1`, { bytes: 500, files: 2, unsized: 3 }],
    ]))
    // Cloudinary never had it.
    await twice(db, vi.fn(async (_type, ids) => new Set(ids)))
    expect(db.collectionData(MEDIA_USAGE)['fam-1']).toEqual({ bytes: 500, files: 2, unsized: 2 })
  })

  it('destroys each resource type on its own', async () => {
    const db = fakeAdminFirestore(Object.fromEntries([
      pending('a', 10),
      pending('b', 10, { resourceType: 'image', publicId: `kaydo/public/fam-1/${hex('b')}` }),
    ]))
    const destroy = destroyAll()
    await twice(db, destroy)
    // First each file under the kind it was signed for…
    expect(destroy).toHaveBeenCalledWith('raw', [`kaydo/fam-1/${hex('a')}`])
    expect(destroy).toHaveBeenCalledWith('image', [`kaydo/public/fam-1/${hex('b')}`])
  })

  it('clears the other kinds a signature could have been used for, once the file is gone', async () => {
    // Cloudinary does not sign resource_type: one signature stores up to three
    // files under one id, and the ledger knows of one.
    const db = fakeAdminFirestore(Object.fromEntries([pending('a', 10)]))
    const destroy = destroyAll()
    const { second: stats } = await twice(db, destroy)
    expect(destroy.mock.calls).toEqual([
      ['raw', [`kaydo/fam-1/${hex('a')}`]],
      ['image', [`kaydo/fam-1/${hex('a')}`]],
      ['video', [`kaydo/fam-1/${hex('a')}`]],
    ])
    expect(stats).toMatchObject({ deleted: 1, failed: 0 })
  })

  it('does not touch the other kinds of a file Cloudinary kept, and survives their refusal', async () => {
    const kept = fakeAdminFirestore(Object.fromEntries([pending('a', 10)]))
    const refuse = vi.fn(async () => new Set())
    await twice(kept, refuse)
    expect(refuse.mock.calls.map(([type]) => type)).toEqual(['raw'])

    const db = fakeAdminFirestore(Object.fromEntries([pending('a', 10)]))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { second: stats } = await twice(db, vi.fn(async (type, ids) => {
      if (type !== 'raw') throw new Error('503')
      return new Set(ids)
    }))
    error.mockRestore()
    expect(stats).toMatchObject({ deleted: 1, failed: 0 })
    expect(Object.keys(ledger(db))).toEqual([])
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
    expect(stats).toMatchObject({ due: 1, kept: 1, reserved: 0, deleted: 0 })
    expect(destroy).not.toHaveBeenCalled()
  })

  it('keeps and re-attaches a "detached" file the document that let it go still shows', async () => {
    // A ledger left wrong by a trigger: the last look at that document is what
    // stops the delete.
    const db = fakeAdminFirestore(Object.fromEntries([
      detached('a', 40, { detachedFrom: 'memories/m1' }),
      ['memories/m1', { familyId: 'fam-1', mediaRefs: { images: [`kaydo/fam-1/${hex('a')}`] } }],
    ]))
    const destroy = destroyAll()
    const stats = await run(db, destroy)
    expect(stats).toMatchObject({ due: 1, kept: 1, deleted: 0 })
    expect(destroy).not.toHaveBeenCalled()
    expect(ledger(db)[hex('a')]).toMatchObject({ state: 'attached', refs: ['memories/m1'], detachedAt: null })
  })

  it('leaves such a file out of the dry run\'s report', async () => {
    const db = fakeAdminFirestore(Object.fromEntries([
      detached('a', 40, { detachedFrom: 'memories/m1' }),
      detached('b', 40, { detachedFrom: 'memories/m2' }),
      ['memories/m1', { familyId: 'fam-1', mediaRefs: { images: [`kaydo/fam-1/${hex('a')}`] } }],
      ['memories/m2', { familyId: 'fam-1', mediaRefs: { images: [] } }],
    ]))
    const stats = await run(db, destroyAll(), true)
    expect(stats).toMatchObject({ due: 2, kept: 1, wouldDelete: [`kaydo/fam-1/${hex('b')}`] })
  })

  it('keeps a file whose source document is over the reference cap, in a real run and in the dry run', async () => {
    // Too many ids to trust means "unknown", not "empty": the file is kept even
    // though the document does not name it among the ones it can be read for.
    const many = Array.from({ length: MAX_MEDIA_REFS + 1 }, (_, i) => `kaydo/fam-1/${i.toString(16).padStart(32, '0')}`)
    const db = fakeAdminFirestore(Object.fromEntries([
      detached('a', 40, { detachedFrom: 'memories/m1' }),
      ['memories/m1', { familyId: 'fam-1', mediaRefs: { images: many } }],
    ]))
    const dry = await run(db, destroyAll(), true)
    expect(dry).toMatchObject({ due: 1, kept: 1, wouldDelete: [] })
    const destroy = destroyAll()
    const stats = await run(db, destroy)
    expect(stats).toMatchObject({ due: 1, kept: 1, deleted: 0 })
    expect(destroy).not.toHaveBeenCalled()
    expect(Object.keys(ledger(db))).toEqual([hex('a')])
  })

  it('deletes a file the document that let it go no longer holds', async () => {
    const db = fakeAdminFirestore(Object.fromEntries([
      detached('a', 40, { detachedFrom: 'memories/m1' }),
      ['memories/m1', { familyId: 'fam-1', mediaRefs: { images: [] } }],
    ]))
    const { second: stats } = await twice(db, destroyAll())
    expect(stats).toMatchObject({ deleted: 1 })
  })

  it('keeps and attaches a "pending" file a document of the family names', async () => {
    // The attach never arrived: a lost trigger, or functions that did not know
    // the collection yet. The ledger alone says "abandoned upload".
    const db = fakeAdminFirestore(Object.fromEntries([
      pending('a', 10),
      pending('b', 10),
      ['recipes/r1', { familyId: 'fam-1', mediaRefs: { images: [`kaydo/fam-1/${hex('a')}`] } }],
    ]))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const destroy = destroyAll()
    const first = await run(db, destroy)
    expect(first).toMatchObject({ due: 2, kept: 1, reserved: 1 })
    const stats = await run(db, destroy, false, NEXT)
    error.mockRestore()
    expect(stats).toMatchObject({ deleted: 1 })
    expect(destroy).toHaveBeenCalledWith('raw', [`kaydo/fam-1/${hex('b')}`])
    expect(ledger(db)[hex('a')]).toMatchObject({ state: 'attached', refs: ['recipes/r1'] })
  })

  it('keeps a "detached" file another document of the family names', async () => {
    const db = fakeAdminFirestore(Object.fromEntries([
      detached('a', 40, { detachedFrom: 'memories/m1' }),
      ['scrapbooks/s1', { familyId: 'fam-1', mediaRefs: { pages: [`kaydo/fam-1/${hex('a')}`] } }],
    ]))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const stats = await run(db, destroyAll())
    error.mockRestore()
    expect(stats).toMatchObject({ kept: 1, deleted: 0 })
    expect(ledger(db)[hex('a')]).toMatchObject({ state: 'attached', refs: ['scrapbooks/s1'] })
  })

  it('keeps a file the family document names for its login page', async () => {
    const db = fakeAdminFirestore(Object.fromEntries([
      pending('a', 10),
      ['families/fam-1', { mediaRefs: { loginHeaderImage: [`kaydo/fam-1/${hex('a')}`] } }],
    ]))
    const dry = await run(db, destroyAll(), true)
    expect(dry).toMatchObject({ due: 1, kept: 1, wouldDelete: [] })
  })

  it('does not keep a file only another family\'s document names', async () => {
    const db = fakeAdminFirestore(Object.fromEntries([
      pending('a', 10),
      ['memories/m9', { familyId: 'fam-2', mediaRefs: { images: [`kaydo/fam-1/${hex('a')}`] } }],
    ]))
    expect((await twice(db, destroyAll())).second).toMatchObject({ deleted: 1 })
  })

  it('keeps a file whose ledger entry names no family', async () => {
    const db = fakeAdminFirestore(Object.fromEntries([pending('a', 10, { familyId: undefined })]))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const destroy = destroyAll()
    const stats = await run(db, destroy)
    error.mockRestore()
    expect(stats).toMatchObject({ kept: 1, deleted: 0 })
    expect(destroy).not.toHaveBeenCalled()
  })

  it('leaves the ledger alone when Cloudinary refuses, so the next run tries again', async () => {
    const db = fakeAdminFirestore(Object.fromEntries([pending('a', 10)]))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { second: stats } = await twice(db, vi.fn(async () => { throw new Error('503') }))
    expect(stats).toMatchObject({ failed: 1, deleted: 0 })
    // Past the point of no return, so it stays `destroying` and every run asks again.
    expect(ledger(db)[hex('a')].state).toBe('destroying')
    const retry = await run(db, destroyAll(), false, NEXT + DAY)
    error.mockRestore()
    expect(retry).toMatchObject({ deleted: 1, failed: 0 })
    expect(Object.keys(ledger(db))).toEqual([])
  })

  it('keeps the entry of a file Cloudinary did not report as gone', async () => {
    const db = fakeAdminFirestore(Object.fromEntries([pending('a', 10), pending('b', 10)]))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { second: stats } = await twice(db, vi.fn(async () => new Set([`kaydo/fam-1/${hex('a')}`])))
    error.mockRestore()
    expect(stats).toMatchObject({ deleted: 1, failed: 1 })
    expect(Object.keys(ledger(db))).toEqual([hex('b')])
  })
})

describe('the reservation', () => {
  const memoryWith = (c) => ['memories/m1', { familyId: 'fam-1', mediaRefs: { images: [`kaydo/fam-1/${hex(c)}`] } }]
  const doc = (db, c) => db.docs.get(`${MEDIA_ASSETS}/${hex(c)}`)

  it('destroys nothing in the run that reserves, even for a file due for months', async () => {
    const db = fakeAdminFirestore(Object.fromEntries([detached('a', 400)]))
    const destroy = destroyAll()
    await run(db, destroy)
    await run(db, destroy, false, NOW + RESERVATION_MS - 1)
    expect(destroy).not.toHaveBeenCalled()
    expect(doc(db, 'a').state).toBe('deleting')
  })

  it('does not reserve twice or move the date a reservation counts from', async () => {
    const db = fakeAdminFirestore(Object.fromEntries([detached('a', 40)]))
    await run(db, destroyAll())
    const again = await run(db, destroyAll(), false, NOW + 60 * 1000)
    expect(again).toMatchObject({ due: 0, reserved: 0 })
    expect(doc(db, 'a').deletingSince).toEqual(new Date(NOW))
  })

  it('is cancelled by the trigger that attaches the file, and the file is never destroyed', async () => {
    // The write the clean-up could not see when it reserved: its trigger runs afterwards.
    const db = fakeAdminFirestore(Object.fromEntries([detached('a', 40, { detachedFrom: 'memories/m1' })]))
    const destroy = destroyAll()
    await run(db, destroy)
    const written = { familyId: 'fam-1', mediaRefs: { images: [`kaydo/fam-1/${hex('a')}`] } }
    db.docs.set('memories/m1', written)
    await trackMediaRefs({ db, now: () => NOW + 1000 }, { collection: 'memories', docId: 'm1', before: { familyId: 'fam-1' }, after: written })
    expect(doc(db, 'a')).toMatchObject({ state: 'attached', refs: ['memories/m1'], detachedAt: null, deletingSince: null })

    const stats = await run(db, destroy, false, NEXT)
    expect(stats).toMatchObject({ deleted: 0 })
    expect(destroy).not.toHaveBeenCalled()
    expect(Object.keys(ledger(db))).toEqual([hex('a')])
  })

  it('keeps a file a document holds by the time it would be destroyed, even if its trigger never ran', async () => {
    const db = fakeAdminFirestore(Object.fromEntries([pending('a', 10)]))
    const destroy = destroyAll()
    await run(db, destroy)
    db.docs.set(...memoryWith('a'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const stats = await run(db, destroy, false, NEXT)
    error.mockRestore()
    expect(stats).toMatchObject({ kept: 1, deleted: 0 })
    expect(destroy).not.toHaveBeenCalled()
    expect(doc(db, 'a')).toMatchObject({ state: 'attached', refs: ['memories/m1'] })
  })

  it('keeps the entry as lost, and never destroys it again, when a reference arrives after the point of no return', async () => {
    const db = fakeAdminFirestore(Object.fromEntries([
      detached('a', 40, { bytes: 50, detachedFrom: 'memories/m1' }),
      [`${MEDIA_USAGE}/fam-1`, { bytes: 50, files: 1, unsized: 0 }],
    ]))
    await run(db, destroyAll())
    // Cloudinary is asked; while it works, a document names the file.
    const written = { familyId: 'fam-1', mediaRefs: { images: [`kaydo/fam-1/${hex('a')}`] } }
    const destroy = vi.fn(async (_type, ids) => {
      db.docs.set('memories/m1', written)
      await trackMediaRefs({ db, now: () => NEXT }, { collection: 'memories', docId: 'm1', before: { familyId: 'fam-1' }, after: written })
      return new Set(ids)
    })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const stats = await run(db, destroy, false, NEXT)
    expect(stats).toMatchObject({ deleted: 0, raced: 1 })
    expect(error).toHaveBeenCalledWith(expect.stringContaining('lost'), hex('a'))
    // The trigger only recorded the reference; the clean-up decided the state.
    expect(doc(db, 'a')).toMatchObject({ state: 'lost', refs: ['memories/m1'], lostAt: new Date(NEXT) })

    const later = destroyAll()
    expect(await run(db, later, false, NEXT + 10 * DAY)).toMatchObject({ due: 0, deleted: 0, raced: 0 })
    error.mockRestore()
    expect(later).not.toHaveBeenCalled()
    expect(doc(db, 'a').state).toBe('lost')
  })
})

describe('destroyUnderOtherTypes', () => {
  it('names the ids that are not gone under every other type, and never throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const destroy = vi.fn(async (type, ids) => {
      if (type === 'video') throw new Error('503')
      return new Set(ids.filter((id) => id !== 'b'))
    })
    const uncleared = await destroyUnderOtherTypes(destroy, 'raw', ['a', 'b'])
    error.mockRestore()
    expect([...uncleared].sort()).toEqual(['a', 'b'])

    const fine = await destroyUnderOtherTypes(vi.fn(async (_type, ids) => new Set(ids)), 'raw', ['a'])
    expect(fine.size).toBe(0)
    expect((await destroyUnderOtherTypes(destroy, 'raw', [])).size).toBe(0)
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

  it('has the CDN forget a readable picture, and leaves ciphertext to expire', async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ deleted: {} }) }))
    const destroy = cloudinaryDestroyer({ fetch, cloudName: 'demo', apiKey: 'key', secret: 'secret' })
    await destroy('image', ['kaydo/public/fam/login'])
    await destroy('raw', ['kaydo/fam/photo'])
    expect(new URL(fetch.mock.calls[0][0]).searchParams.get('invalidate')).toBe('true')
    expect(new URL(fetch.mock.calls[1][0]).searchParams.has('invalidate')).toBe(false)
  })

  it('throws when Cloudinary refuses', async () => {
    const destroy = cloudinaryDestroyer({ fetch: async () => ({ ok: false, status: 401 }), cloudName: 'demo', apiKey: 'k', secret: 's' })
    await expect(destroy('raw', ['x'])).rejects.toThrow('401')
  })
})
