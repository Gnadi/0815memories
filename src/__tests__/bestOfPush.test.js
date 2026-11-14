/**
 * Tests for functions/bestOf.js — which month the push on the 1st is about,
 * which families get it, and what it says. The query itself runs against the
 * emulator in bestOfRules.test.js.
 */
import { describe, it, expect } from 'vitest'
import {
  BEST_OF_MIN_MEDIA,
  bestOfCopy,
  bestOfUrl,
  countMonthMedia,
  familiesWithBestOf,
  previousMonthWindow,
} from '../../functions/bestOf.js'

const BERLIN = 'Europe/Berlin'

describe('previousMonthWindow', () => {
  it('covers last month, midnight to midnight in the family’s time zone', () => {
    // 1 October 2026, 18:00 in Berlin — when the job runs (UTC+2 until the
    // end of October, so both ends of September are summer time).
    const window = previousMonthWindow(new Date('2026-10-01T16:00:00Z'), BERLIN)
    expect(window.key).toBe('2026-09')
    expect(window.start.toISOString()).toBe('2026-08-31T22:00:00.000Z')
    expect(window.end.toISOString()).toBe('2026-09-30T22:00:00.000Z')
  })

  it('crosses the clock change and the turn of the year', () => {
    // November: October began in summer time and ended in winter time.
    const october = previousMonthWindow(new Date('2026-11-01T17:00:00Z'), BERLIN)
    expect(october.key).toBe('2026-10')
    expect(october.start.toISOString()).toBe('2026-09-30T22:00:00.000Z')
    expect(october.end.toISOString()).toBe('2026-10-31T23:00:00.000Z')

    const december = previousMonthWindow(new Date('2027-01-01T17:00:00Z'), BERLIN)
    expect(december).toMatchObject({ key: '2026-12', year: 2026, month: 12 })
  })

  it('goes by the family’s calendar, not the server’s', () => {
    // 23:30 UTC on 31 October is already 1 November in Berlin.
    expect(previousMonthWindow(new Date('2026-10-31T23:30:00Z'), BERLIN).key).toBe('2026-10')
  })
})

describe('countMonthMedia', () => {
  // Stands in for the Admin SDK: one fixed list per collection.
  function fakeDb(collections) {
    return {
      collection: (name) => {
        const query = {
          where: () => query,
          select: () => query,
          get: async () => ({
            docs: (collections[name] ?? []).map((data) => ({ get: (field) => data[field] })),
          }),
        }
        return query
      },
    }
  }

  it('adds up photos and clips per family, across memories and moments', async () => {
    const db = fakeDb({
      memories: [
        { familyId: 'a', images: ['1', '2', '3'], videos: [{ url: 'v' }] },
        { familyId: 'a', imageUrl: 'legacy' },
        { familyId: 'b', images: [], videos: [] },
      ],
      moments: [
        { familyId: 'a', images: ['4'] },
        { familyId: 'c', images: ['x', 'y'] },
        { images: ['orphan'] },
      ],
    })
    const counts = await countMonthMedia(db, { start: new Date(0), end: new Date(1) })
    expect(Object.fromEntries(counts)).toEqual({ a: { photos: 5, videos: 1 }, c: { photos: 2, videos: 0 } })
  })
})

describe('familiesWithBestOf', () => {
  it('tells only families with enough for a best-of', () => {
    const counts = new Map([
      ['a', { photos: BEST_OF_MIN_MEDIA - 1, videos: 1 }],
      ['b', { photos: BEST_OF_MIN_MEDIA - 2, videos: 1 }],
      ['c', { photos: 200, videos: 0 }],
    ])
    expect(familiesWithBestOf(counts)).toEqual(['a', 'c'])
  })

  it('does not tell a family that only posted clips, which the app makes no best-of of', () => {
    const counts = new Map([['clips', { photos: 0, videos: BEST_OF_MIN_MEDIA + 4 }]])
    expect(familiesWithBestOf(counts)).toEqual([])
  })
})

describe('bestOfCopy', () => {
  const september = previousMonthWindow(new Date('2026-10-01T16:00:00Z'), BERLIN)

  it('names the month in the device’s language, and nothing else', () => {
    expect(bestOfCopy('de', september).title).toBe('✨ Best of September')
    expect(bestOfCopy('de', september).body).toContain('September')
    expect(bestOfCopy('en-GB', september).title).toBe('✨ Best of September')

    const march = previousMonthWindow(new Date('2026-04-01T16:00:00Z'), BERLIN)
    expect(bestOfCopy('de', march).title).toBe('✨ Best of März')
    expect(bestOfCopy('en', march).title).toBe('✨ Best of March')
  })

  it('links to the month the app names the same way', () => {
    expect(bestOfUrl(september.key)).toBe('/best-of/2026-09')
  })
})
