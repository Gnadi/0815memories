import { describe, it, expect } from 'vitest'
import { thumbsFor, thumbAt, needsThumbs, buildThumbs } from '../utils/mediaThumbs'

describe('mediaThumbs', () => {
  it('returns the thumbs when they line up with images', () => {
    const doc = { images: ['a.enc', 'b.enc'], thumbs: ['a-t.enc', 'b-t.enc'] }
    expect(thumbsFor(doc)).toEqual(['a-t.enc', 'b-t.enc'])
    expect(thumbAt(doc, 1)).toBe('b-t.enc')
  })

  it('ignores a thumbs array whose length does not match images', () => {
    // The dangerous case: a stale field would otherwise show the wrong photo.
    const doc = { images: ['a.enc', 'b.enc', 'c.enc'], thumbs: ['a-t.enc'] }
    expect(thumbsFor(doc)).toEqual([])
    expect(thumbAt(doc, 0)).toBe('')
  })

  it.each([
    ['no thumbs field', { images: ['a.enc'] }],
    ['thumbs but no images', { thumbs: ['a-t.enc'] }],
    ['thumbs is not an array', { images: ['a.enc'], thumbs: 'a-t.enc' }],
    ['empty document', {}],
    ['null', null],
  ])('falls back to the original for %s', (_label, doc) => {
    expect(thumbsFor(doc)).toEqual([])
    expect(thumbAt(doc, 0)).toBe('')
  })

  it('reports a document as needing a backfill only when it has images and no usable thumbs', () => {
    expect(needsThumbs({ images: ['a.enc'] })).toBe(true)
    expect(needsThumbs({ images: ['a.enc', 'b.enc'], thumbs: ['a-t.enc'] })).toBe(true)
    expect(needsThumbs({ images: ['a.enc'], thumbs: ['a-t.enc'] })).toBe(false)
    // All-empty counts as considered, so it is not revisited forever.
    expect(needsThumbs({ images: ['a.enc'], thumbs: [''] })).toBe(false)
    expect(needsThumbs({ images: [] })).toBe(false)
    expect(needsThumbs({})).toBe(false)
  })

  it('builds a positional thumbs array, padding images that have none', () => {
    expect(
      buildThumbs([{ url: 'a.enc', thumbUrl: 'a-t.enc' }, { url: 'b.enc' }])
    ).toEqual(['a-t.enc', ''])
  })

  it('returns null when no image has a thumbnail, so the field is left off entirely', () => {
    expect(buildThumbs([{ url: 'a.enc' }, { url: 'b.enc', thumbUrl: '' }])).toBeNull()
    expect(buildThumbs([])).toBeNull()
  })

  it('round-trips: what buildThumbs writes, thumbsFor reads back', () => {
    const uploaded = [
      { url: 'a.enc', thumbUrl: 'a-t.enc' },
      { url: 'b.enc', thumbUrl: '' },
    ]
    const stored = { images: uploaded.map((i) => i.url), thumbs: buildThumbs(uploaded) }
    expect(thumbAt(stored, 0)).toBe('a-t.enc')
    expect(thumbAt(stored, 1)).toBe('')
  })
})
