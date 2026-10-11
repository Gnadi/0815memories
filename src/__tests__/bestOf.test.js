import { describe, it, expect } from 'vitest'
import {
  BEST_OF_VERSION,
  MIN_BEST_OF_MEDIA,
  buildBestOf,
  chooseAwards,
  chooseThemes,
  collectMedia,
  currentBestOfMonth,
  isMonthKey,
  monthKey,
  monthRange,
  parseMonthKey,
  pickCandidates,
  scorePhoto,
} from '../utils/bestOf'
import { BEST_OF_MIN_MEDIA } from '../../functions/bestOf.js'

const day = (d, h = 12) => new Date(2026, 8, d, h) // September 2026

function memory(id, d, images, extra = {}) {
  return { id, date: day(d), title: `Memory ${id}`, images, thumbs: images.map((u) => `${u}-t`), ...extra }
}

function moment(id, d, images, extra = {}) {
  return { id, date: day(d), caption: `Moment ${id}`, images, ...extra }
}

// A month with enough in it: eight entries over eight days, ten photos, a clip.
function september() {
  return {
    memories: [
      memory('lake', 3, ['lake1', 'lake2', 'lake3'], { location: 'Zell am See', category: 'Travel', featured: true }),
      memory('hike', 10, ['hike1'], { location: 'Schmittenhöhe', category: 'Adventure' }),
      memory('bday', 20, ['bday1', 'bday2'], { location: 'Home', category: 'Celebration' }),
    ],
    moments: [
      moment('m1', 4, ['m1'], { location: 'Zell am See', category: 'Travel' }),
      moment('m2', 12, ['m2'], { label: 'Playground', category: 'Kids' }),
      moment('m3', 14, ['m3'], { category: 'Kids', videos: [{ url: 'clip1' }] }),
      moment('m4', 25, ['m4'], { category: 'Everyday' }),
      moment('m5', 28, [], { videos: [{ url: 'clip2' }] }),
    ],
  }
}

describe('months', () => {
  it('names a month by its local year and month', () => {
    expect(monthKey(new Date(2026, 8, 30, 23, 59))).toBe('2026-09')
    expect(monthKey(new Date(2026, 0, 1))).toBe('2026-01')
  })

  it('accepts only real months', () => {
    expect(isMonthKey('2026-09')).toBe(true)
    expect(isMonthKey('2026-13')).toBe(false)
    expect(isMonthKey('2026-9')).toBe(false)
    expect(isMonthKey('../2026-09')).toBe(false)
    expect(parseMonthKey('nope')).toBeNull()
    expect(parseMonthKey('2026-12')).toEqual({ year: 2026, month: 11 })
  })

  it('spans the whole month and nothing after it', () => {
    const [start, end] = monthRange('2026-12')
    expect(start).toEqual(new Date(2026, 11, 1))
    expect(end).toEqual(new Date(2027, 0, 1))
  })

  it('makes the month that just ended the current one', () => {
    expect(currentBestOfMonth(new Date(2026, 9, 1, 0, 5))).toBe('2026-09')
    expect(currentBestOfMonth(new Date(2026, 9, 31))).toBe('2026-09')
    expect(currentBestOfMonth(new Date(2027, 0, 15))).toBe('2026-12')
  })

  it('asks for as many photos as the push does', () => {
    // functions/bestOf.js decides whether the family is told; this decides
    // whether the app makes one. A family must not be told about a best-of
    // the app then refuses to make.
    expect(MIN_BEST_OF_MEDIA).toBe(BEST_OF_MIN_MEDIA)
  })
})

describe('collectMedia', () => {
  it('flattens photos and clips of both kinds of entry, oldest first', () => {
    // Within an entry, in the order its author put them, photos first.
    const media = collectMedia(september())
    expect(media.map((m) => m.url)).toEqual([
      'lake1', 'lake2', 'lake3', 'm1', 'hike1', 'm2', 'm3', 'clip1', 'bday1', 'bday2', 'm4', 'clip2',
    ])
    const lake = media[0]
    expect(lake).toMatchObject({
      type: 'image', thumbUrl: 'lake1-t', source: 'memory', caption: 'Memory lake',
      location: 'Zell am See', themes: ['Travel'], featured: true, day: '2026-09-03',
    })
    expect(media.find((m) => m.url === 'clip1')).toMatchObject({ type: 'video', caption: 'Moment m3' })
  })

  it('reads a single legacy imageUrl and skips entries without a date', () => {
    const media = collectMedia({
      memories: [{ id: 'old', date: { toDate: () => day(1) }, imageUrl: 'legacy' }, { id: 'undated', images: ['x'] }],
    })
    expect(media.map((m) => m.url)).toEqual(['legacy'])
    expect(media[0].thumbUrl).toBe('')
  })

  it('shows a photo shared twice only once', () => {
    const media = collectMedia({ memories: [memory('a', 1, ['same'])], moments: [moment('b', 2, ['same'])] })
    expect(media).toHaveLength(1)
  })
})

describe('pickCandidates', () => {
  it('takes the first photo of every entry before a second from any', () => {
    const memories = [
      memory('big', 1, Array.from({ length: 20 }, (_, i) => `big${i}`)),
      memory('small', 2, ['small0']),
      memory('other', 3, ['other0', 'other1']),
    ]
    const picked = pickCandidates(collectMedia({ memories }), 4).map((m) => m.url)
    expect(picked).toEqual(expect.arrayContaining(['big0', 'small0', 'other0']))
    expect(picked).toHaveLength(4)
  })
})

describe('scorePhoto', () => {
  const item = { url: 'p', source: 'moment', index: 1 }

  it('prefers smiling people over sharp scenery', () => {
    const analysis = new Map([
      ['smile', { sharpness: 0.4, brightness: 0.5, colorfulness: 0.3, faces: 2, smile: 0.9 }],
      ['scene', { sharpness: 1, brightness: 0.5, colorfulness: 0.6, faces: 0, smile: 0 }],
    ])
    expect(scorePhoto({ ...item, url: 'smile' }, analysis)).toBeGreaterThan(scorePhoto({ ...item, url: 'scene' }, analysis))
  })

  it('prefers a featured memory when nothing was measured', () => {
    expect(scorePhoto({ ...item, source: 'memory', featured: true }, new Map()))
      .toBeGreaterThan(scorePhoto(item, new Map()))
  })
})

describe('chooseAwards', () => {
  const media = collectMedia(september())
  const scores = new Map(media.map((m) => [m.url, 0.5]))

  it('gives the biggest smile to the widest smile, and only a real one', () => {
    const analysis = new Map([
      ['m2', { faces: 1, smile: 0.7 }],
      ['hike1', { faces: 1, smile: 0.95 }],
      ['bday1', { faces: 1, smile: 0.3 }],
    ])
    const [first] = chooseAwards(media, analysis, scores)
    expect(first).toMatchObject({ award: 'smile', item: { url: 'hike1' } })

    const noSmiles = chooseAwards(media, new Map([['bday1', { faces: 1, smile: 0.3 }]]), scores)
    expect(noSmiles.map((a) => a.award)).not.toContain('smile')
  })

  it('gives every award a different photo and stops at three', () => {
    const analysis = new Map([
      ['lake1', { faces: 4, smile: 0.9 }],
      ['lake2', { faces: 5, smile: 0.2 }],
    ])
    const awards = chooseAwards(media, analysis, scores)
    expect(awards.map((a) => a.award)).toEqual(['smile', 'group', 'place'])
    expect(new Set(awards.map((a) => a.item.url)).size).toBe(awards.length)
    expect(awards[1].detail).toEqual({ faces: 5 })
    expect(awards[2].detail).toMatchObject({ place: 'Zell am See', entries: 2 })
  })

  it('finds a busiest day and a story of the month without any analysis', () => {
    const busy = {
      memories: [memory('trip', 5, ['t1', 't2', 't3', 't4'], { featured: true })],
      moments: [moment('x', 9, ['x1'])],
    }
    const list = collectMedia(busy)
    const awards = chooseAwards(list, new Map(), new Map(list.map((m) => [m.url, 0.5])))
    expect(awards.map((a) => a.award)).toEqual(['busiestDay', 'story'])
    expect(awards[0].detail).toEqual({ day: '2026-09-05', count: 4, videos: 0 })
  })
})

describe('chooseThemes', () => {
  it('names what the month was about, most frequent first, a photo each', () => {
    const media = collectMedia(september())
    const themes = chooseThemes(media, new Map(media.map((m) => [m.url, 0.5])))
    expect(themes.map((t) => t.theme)).toEqual(['Kids', 'Travel', 'Adventure'])
    expect(new Set(themes.map((t) => t.item.url)).size).toBe(3)
  })

  it('falls back to places, and to nothing when there is one subject', () => {
    const one = collectMedia({ moments: [moment('a', 1, ['a'], { category: 'Kids' }), moment('b', 2, ['b'], { category: 'kids' })] })
    expect(chooseThemes(one, new Map())).toEqual([])

    const places = collectMedia({ moments: [moment('a', 1, ['a'], { location: 'Lake' }), moment('b', 2, ['b'], { location: 'Hill' })] })
    expect(chooseThemes(places, new Map()).map((t) => t.theme)).toEqual(['Hill', 'Lake'])
  })
})

describe('buildBestOf', () => {
  it('makes nothing of a month with too little in it', () => {
    expect(buildBestOf({ month: '2026-09', moments: [moment('a', 1, ['a', 'b', 'c'])] })).toBeNull()
    // Clips alone are no story either: there is nothing for the cards to show.
    const clips = Array.from({ length: 8 }, (_, i) => moment(`c${i}`, i + 1, [], { videos: [{ url: `v${i}` }] }))
    expect(buildBestOf({ month: '2026-09', moments: clips })).toBeNull()
  })

  it('opens, counts, names the themes, shows the month and closes', () => {
    const analysis = new Map([['m2', { faces: 2, smile: 0.9, sharpness: 0.8, brightness: 0.5, colorfulness: 0.4 }]])
    const bestOf = buildBestOf({ month: '2026-09', ...september(), analysis })

    expect(bestOf).toMatchObject({ version: BEST_OF_VERSION, month: '2026-09', counts: { photos: 10, videos: 2 } })
    const kinds = bestOf.slides.map((s) => s.kind)
    expect(kinds.slice(0, 3)).toEqual(['intro', 'count', 'themes'])
    expect(kinds.at(-1)).toBe('outro')
    expect(kinds).toContain('video')

    // Each award is announced, then shown.
    const intro = kinds.indexOf('awardIntro')
    expect(kinds[intro + 1]).toBe('award')
    expect(bestOf.slides[intro + 1]).toMatchObject({ award: 'smile', media: { url: 'm2' } })
    expect(bestOf.awards[0]).toBe('smile')

    // The photos between the cards run in the order they were taken, up to
    // the last look at what did not make it.
    const end = kinds.includes('dontForget') ? kinds.indexOf('dontForget') : kinds.length
    const days = bestOf.slides.slice(0, end).filter((s) => s.kind === 'photo' || s.kind === 'video').map((s) => s.day)
    expect(days.length).toBeGreaterThan(3)
    expect([...days].sort()).toEqual(days)
  })

  it('never shows a photo twice in the run of the month', () => {
    const bestOf = buildBestOf({ month: '2026-09', ...september() })
    const shown = bestOf.slides
      .filter((s) => ['photo', 'video', 'award', 'dontForget'].includes(s.kind))
      .map((s) => s.media.url)
    expect(new Set(shown).size).toBe(shown.length)
  })

  it('keeps no empty fields on its photos', () => {
    const bestOf = buildBestOf({ month: '2026-09', ...september() })
    const clip = bestOf.slides.find((s) => s.kind === 'video')
    expect(clip.media).toEqual({ url: expect.any(String) })
    expect(bestOf.cover).toEqual({ url: 'lake1', thumbUrl: 'lake1-t' })
  })

  it('arrives at the same story from the same month, whatever order it is read in', () => {
    const a = buildBestOf({ month: '2026-09', ...september() })
    const shuffled = september()
    shuffled.memories.reverse()
    shuffled.moments.reverse()
    expect(buildBestOf({ month: '2026-09', ...shuffled })).toEqual(a)
  })
})
