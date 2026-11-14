// @vitest-environment node
/**
 * Keeping the media ledger in step with the documents — functions/mediaRefs.js.
 *
 * What it records decides what the clean-up deletes, so the cases that must
 * hold are the ones where a file is still in use: a second document holding
 * it, a partial write that did not touch it, and a document naming another
 * family's file, which must change nothing at all.
 */
import { describe, it, expect } from 'vitest'
import { MEDIA_ASSETS } from '../../functions/mediaSigning.js'
import { ledgerIdOf, parseLegacyRef, refChanges, isOverCap, refsOf, trackMediaRefs, MAX_MEDIA_REFS } from '../../functions/mediaRefs.js'
import { fakeAdminFirestore } from './fakeAdminFirestore.js'

const NOW = Date.parse('2026-10-23T10:00:00Z')
const hex = (c) => c.repeat(32)
const pid = (c, family = 'fam-1') => `kaydo/${family}/${hex(c)}`

function ledger(entries) {
  return fakeAdminFirestore(Object.fromEntries(entries.map(([c, data]) => [
    `${MEDIA_ASSETS}/${hex(c)}`,
    { familyId: 'fam-1', publicId: pid(c), state: 'pending', refs: [], ...data },
  ])))
}

const entry = (db, c) => db.collectionData(MEDIA_ASSETS)[hex(c)]
// The trigger runs after the write: the document is already what `after` says,
// and trackMediaRefs reads it from there.
const store = (db, { collection, docId, after }) => {
  if (after) db.docs.set(`${collection}/${docId}`, { ...after })
  else db.docs.delete(`${collection}/${docId}`)
}
const process = (db, write) => trackMediaRefs({ db, now: () => NOW }, write)
const run = (db, write) => {
  store(db, write)
  return process(db, write)
}
const memory = (mediaRefs, extra = {}) => ({ familyId: 'fam-1', mediaRefs, ...extra })

describe('reading mediaRefs', () => {
  it('takes the ledger id from the ids signUpload makes, and nothing else', () => {
    expect(ledgerIdOf(pid('a'))).toBe(hex('a'))
    expect(ledgerIdOf(`kaydo/public/fam-1/${hex('b')}`)).toBe(hex('b'))
    expect(ledgerIdOf('kaydo/encrypted/abcdefghij0123456789')).toBe(null)
    expect(ledgerIdOf(`../${pid('a')}`)).toBe(null)
    expect(ledgerIdOf(42)).toBe(null)
  })

  it('collects the ids of every field, and ignores what is malformed', () => {
    expect([...refsOf(memory({ images: [pid('a')], thumbs: [pid('b'), 'nonsense'], title: 'x' }))].sort())
      .toEqual([pid('a'), pid('b')])
    expect(refsOf(memory(['a']))).toEqual(new Set())
    expect(refsOf({})).toEqual(new Set())
  })

  it('flags a document naming more files than the app ever writes, instead of reading it as empty', () => {
    const many = Array.from({ length: MAX_MEDIA_REFS + 1 }, (_, i) => `kaydo/fam-1/${i.toString(16).padStart(32, '0')}`)
    expect(isOverCap(memory({ images: many }))).toBe(true)
    expect(isOverCap(memory({ images: many.slice(1) }))).toBe(false)
    expect(refsOf(memory({ images: many })).size).toBe(MAX_MEDIA_REFS + 1)
  })

  it('lets nothing go when the document after a write is over the cap', async () => {
    const many = Array.from({ length: MAX_MEDIA_REFS + 1 }, (_, i) => `kaydo/fam-1/${i.toString(16).padStart(32, '0')}`)
    const db = ledger([['a', { state: 'attached', refs: ['memories/m1'] }]])
    const stats = await run(db, { collection: 'memories', docId: 'm1', before: memory({ images: [pid('a')] }), after: memory({ images: many }) })
    expect(stats).toEqual({ attached: 0, detached: 0, ignored: 0 })
    expect(entry(db, 'a')).toMatchObject({ state: 'attached', refs: ['memories/m1'] })
  })

  it('lets nothing go when the document before a write was over the cap', async () => {
    const many = Array.from({ length: MAX_MEDIA_REFS + 1 }, (_, i) => `kaydo/fam-1/${i.toString(16).padStart(32, '0')}`)
    const db = ledger([['a', { state: 'attached', refs: ['memories/m1'] }]])
    const stats = await run(db, { collection: 'memories', docId: 'm1', before: memory({ images: many }), after: memory({ images: [pid('a')] }) })
    expect(stats).toEqual({ attached: 0, detached: 0, ignored: 0 })
    expect(entry(db, 'a').state).toBe('attached')
  })

  it('takes the family document’s family from its id', () => {
    expect(refChanges('families', 'fam-1', null, { mediaRefs: { loginHeaderImage: [pid('a')] } }))
      .toMatchObject({ added: [pid('a')], addedFamily: 'fam-1' })
  })
})

describe('trackMediaRefs', () => {
  it('attaches a new document’s files', async () => {
    const db = ledger([['a'], ['b']])
    const stats = await run(db, { collection: 'memories', docId: 'm1', before: null, after: memory({ images: [pid('a')], thumbs: [pid('b')] }) })
    expect(stats).toEqual({ attached: 2, detached: 0, ignored: 0 })
    expect(entry(db, 'a')).toMatchObject({ state: 'attached', refs: ['memories/m1'], detachedAt: null })
  })

  it('keeps a file attached while another document still holds it', async () => {
    // A memory turned into a moment: one batch, two writes, two trigger runs.
    const db = ledger([['a', { state: 'attached', refs: ['memories/m1'] }]])
    await run(db, { collection: 'moments', docId: 'n1', before: null, after: memory({ images: [pid('a')] }) })
    await run(db, { collection: 'memories', docId: 'm1', before: memory({ images: [pid('a')] }), after: null })
    expect(entry(db, 'a')).toMatchObject({ state: 'attached', refs: ['moments/n1'] })
  })

  it('lets go of the files of a deleted document', async () => {
    const db = ledger([['a', { state: 'attached', refs: ['memories/m1'] }]])
    const stats = await run(db, { collection: 'memories', docId: 'm1', before: memory({ images: [pid('a')] }), after: null })
    expect(stats.detached).toBe(1)
    expect(entry(db, 'a')).toMatchObject({
      state: 'detached', refs: [], detachedAt: new Date(NOW), detachedFrom: 'memories/m1',
    })
  })

  it('lets go of a file a write took out, and keeps the rest', async () => {
    const db = ledger([['a', { state: 'attached', refs: ['memories/m1'] }], ['b', { state: 'attached', refs: ['memories/m1'] }]])
    await run(db, {
      collection: 'memories',
      docId: 'm1',
      before: memory({ images: [pid('a'), pid('b')] }),
      after: memory({ images: [pid('b')] }),
    })
    expect(entry(db, 'a').state).toBe('detached')
    expect(entry(db, 'b')).toMatchObject({ state: 'attached', refs: ['memories/m1'] })
  })

  it('takes a file back that a document picks up again', async () => {
    const db = ledger([['a', { state: 'detached', refs: [], detachedAt: new Date(NOW - 1000) }]])
    await run(db, { collection: 'memories', docId: 'm2', before: null, after: memory({ images: [pid('a')] }) })
    expect(entry(db, 'a')).toMatchObject({ state: 'attached', refs: ['memories/m2'], detachedAt: null })
  })

  it('changes nothing for a file of another family', async () => {
    const db = ledger([['a', { familyId: 'fam-2', publicId: pid('a', 'fam-2'), state: 'attached', refs: ['memories/x'] }]])
    const before = structuredClone(entry(db, 'a'))
    // Under the other family's own path, and under this family's path with
    // the other family's ledger id.
    await run(db, { collection: 'memories', docId: 'm1', before: null, after: memory({ images: [pid('a', 'fam-2'), pid('a')] }) })
    await run(db, { collection: 'memories', docId: 'x', before: memory({ images: [pid('a', 'fam-2')] }), after: null })
    expect(entry(db, 'a')).toEqual(before)
  })

  it('ignores files the ledger does not know', async () => {
    const db = ledger([])
    const stats = await run(db, { collection: 'memories', docId: 'm1', before: null, after: memory({ images: [pid('a')] }) })
    expect(stats).toEqual({ attached: 0, detached: 0, ignored: 1 })
    expect(db.collectionData(MEDIA_ASSETS)).toEqual({})
  })

  it('leaves an upload no document ever held pending, for the clean-up of abandoned ones', async () => {
    const db = ledger([['a']])
    await run(db, { collection: 'memories', docId: 'm1', before: memory({ images: [pid('a')] }), after: null })
    expect(entry(db, 'a').state).toBe('pending')
  })

  it('keeps a file attached when a take-out and a put-back arrive in reverse order', async () => {
    // Two quick saves: the photo out, then back in. Triggers promise no order,
    // and acting on each write's own before/after left the ledger saying
    // "detached" while the memory showed the photo — a month later the
    // clean-up would have deleted it.
    const db = ledger([['a', { state: 'attached', refs: ['memories/m1'] }]])
    const withPhoto = memory({ images: [pid('a')] })
    const without = memory({ images: [] })
    const takeOut = { collection: 'memories', docId: 'm1', before: withPhoto, after: without }
    const putBack = { collection: 'memories', docId: 'm1', before: without, after: withPhoto }
    store(db, takeOut)
    store(db, putBack)
    await process(db, putBack)
    await process(db, takeOut)
    expect(entry(db, 'a')).toMatchObject({ state: 'attached', refs: ['memories/m1'] })
  })

  it('lands on the same answer when a write is delivered twice', async () => {
    const db = ledger([['a', { state: 'attached', refs: ['memories/m1'] }]])
    const withPhoto = memory({ images: [pid('a')] })
    const takeOut = { collection: 'memories', docId: 'm1', before: withPhoto, after: memory({ images: [] }) }
    const putBack = { collection: 'memories', docId: 'm1', before: memory({ images: [] }), after: withPhoto }
    await run(db, takeOut)
    await run(db, putBack)
    // The take-out again, long after: the memory still holds the photo.
    await process(db, takeOut)
    expect(entry(db, 'a')).toMatchObject({ state: 'attached', refs: ['memories/m1'] })
  })

  it('does not restart the grace period when a deletion is delivered again', async () => {
    const earlier = new Date(NOW - 5 * 24 * 60 * 60 * 1000)
    const db = ledger([['a', { state: 'detached', refs: [], detachedAt: earlier, detachedFrom: 'memories/m1' }]])
    await run(db, { collection: 'memories', docId: 'm1', before: memory({ images: [pid('a')] }), after: null })
    expect(entry(db, 'a').detachedAt).toEqual(earlier)
  })

  it('ignores collections that hold no media', async () => {
    const db = ledger([['a']])
    const stats = await run(db, { collection: 'fcmTokens', docId: 't', before: null, after: memory({ images: [pid('a')] }) })
    expect(stats).toEqual({ attached: 0, detached: 0, ignored: 0 })
    expect(entry(db, 'a').state).toBe('pending')
  })
})

describe('files from before the ledger', () => {
  const LEGACY = 'legacy:raw/kaydo/encrypted/abc123.dat'
  const LEGACY_ID = 'legacy~raw~kaydo%2Fencrypted%2Fabc123.dat'

  it('reads their references, and keeps their ids free of slashes', () => {
    expect(parseLegacyRef(LEGACY)).toEqual({ resourceType: 'raw', publicId: 'kaydo/encrypted/abc123.dat' })
    expect(ledgerIdOf(LEGACY)).toBe(LEGACY_ID)
    expect(ledgerIdOf('legacy:raw/elsewhere/a.dat')).toBe(null)
    expect(ledgerIdOf('legacy:pdf/kaydo/a')).toBe(null)
    expect(refsOf(memory({ images: [LEGACY] }))).toEqual(new Set([LEGACY]))
  })

  it('gives one an entry when a document first names it', async () => {
    const db = ledger([])
    const stats = await run(db, { collection: 'memories', docId: 'm1', before: null, after: memory({ images: [LEGACY] }) })
    expect(stats.attached).toBe(1)
    expect(db.collectionData(MEDIA_ASSETS)[LEGACY_ID]).toEqual({
      familyId: 'fam-1',
      publicId: 'kaydo/encrypted/abc123.dat',
      resourceType: 'raw',
      kind: 'legacy',
      legacy: true,
      state: 'attached',
      refs: ['memories/m1'],
      createdAt: new Date(NOW),
      detachedAt: null,
    })
  })

  it('marks one no document holds any more unused, not detached, so the clean-up never sees it', async () => {
    const db = ledger([])
    await run(db, { collection: 'memories', docId: 'm1', before: null, after: memory({ images: [LEGACY] }) })
    await run(db, { collection: 'memories', docId: 'm1', before: memory({ images: [LEGACY] }), after: null })
    expect(db.collectionData(MEDIA_ASSETS)[LEGACY_ID]).toMatchObject({ state: 'unused', refs: [] })
  })

  it('leaves one another family named first to that family', async () => {
    const db = ledger([])
    await run(db, { collection: 'memories', docId: 'theirs', before: null, after: memory({ images: [LEGACY] }) })
    const stats = await run(db, { collection: 'memories', docId: 'mine', before: null, after: memory({ images: [LEGACY] }, { familyId: 'fam-2' }) })
    expect(stats.ignored).toBe(1)
    expect(db.collectionData(MEDIA_ASSETS)[LEGACY_ID]).toMatchObject({ familyId: 'fam-1', refs: ['memories/theirs'] })
  })
})

describe('files the clean-up has reserved or is destroying', () => {
  const write = { collection: 'memories', docId: 'm1', before: memory({ images: [] }), after: memory({ images: [pid('a')] }) }

  it('cancels a reservation when a document attaches the file', async () => {
    const db = ledger([['a', { state: 'deleting', deletingSince: new Date(NOW - 1000), deletingFrom: 'detached', detachedAt: new Date(NOW - 5000) }]])
    const stats = await run(db, write)
    expect(stats.attached).toBe(1)
    expect(entry(db, 'a')).toMatchObject({ state: 'attached', refs: ['memories/m1'], detachedAt: null, deletingSince: null, deletingFrom: null })
  })

  it('leaves a reservation alone when a document lets the file go', async () => {
    const db = ledger([['a', { state: 'deleting', deletingSince: new Date(NOW - 1000), deletingFrom: 'detached' }]])
    const stats = await run(db, { ...write, before: write.after, after: write.before })
    expect(stats.detached).toBe(1)
    expect(entry(db, 'a')).toMatchObject({ state: 'deleting', refs: [] })
  })

  it('only records a reference on a file already being destroyed or lost', async () => {
    for (const state of ['destroying', 'lost']) {
      const db = ledger([['a', { state }]])
      await run(db, write)
      expect(entry(db, 'a')).toMatchObject({ state, refs: ['memories/m1'] })
    }
  })
})
