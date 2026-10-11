import { describe, it, expect } from 'vitest'
import {
  BEST_OF_VERSION,
  MIN_BEST_OF_MEDIA,
  MOTIONS,
  buildBestOf,
  chooseAwards,
  chooseBeats,
  chooseThemes,
  collectMedia,
  currentBestOfMonth,
  isMonthKey,
  monthKey,
  monthRange,
  parseMonthKey,
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

const scoresOf = (media) => new Map(media.map((m) => [m.url, scorePhoto(m)]))

describe('scorePhoto', () => {
  const item = { url: 'p', source: 'moment', index: 0, photos: 1 }

  it('goes by what the family said: the featured memory, then memories, then albums', () => {
    expect(scorePhoto({ ...item, source: 'memory', featured: true })).toBeGreaterThan(scorePhoto({ ...item, source: 'memory' }))
    expect(scorePhoto({ ...item, source: 'memory' })).toBeGreaterThan(scorePhoto(item))
    expect(scorePhoto({ ...item, photos: 5 })).toBeGreaterThan(scorePhoto(item))
  })

  it('keeps an album in its author’s order', () => {
    expect(scorePhoto({ ...item, photos: 4, index: 0 })).toBeGreaterThan(scorePhoto({ ...item, photos: 4, index: 1 }))
  })
})

describe('chooseAwards', () => {
  it('names the place of the month, where most entries were made', () => {
    const media = collectMedia(september())
    const awards = chooseAwards(media, scoresOf(media))
    expect(awards.map((a) => a.award)).toEqual(['place', 'story'])
    expect(awards[0].detail).toEqual({ place: 'Zell am See', entries: 2 })
    // The story of the month is the featured memory.
    expect(awards[1].item.entryId).toBe('memory:lake')
    expect(new Set(awards.map((a) => a.item.url)).size).toBe(awards.length)
  })

  it('finds a busiest day, and gives no award a month has not earned', () => {
    const busy = {
      memories: [memory('trip', 5, ['t1', 't2', 't3', 't4'])],
      moments: [moment('x', 9, ['x1'])],
    }
    const list = collectMedia(busy)
    const awards = chooseAwards(list, scoresOf(list))
    expect(awards.map((a) => a.award)).toEqual(['busiestDay', 'story'])
    expect(awards[0].detail).toEqual({ day: '2026-09-05', count: 4, videos: 0 })

    const quiet = collectMedia({ moments: [moment('a', 1, ['a']), moment('b', 2, ['b'])] })
    expect(chooseAwards(quiet, scoresOf(quiet))).toEqual([])
  })
})

describe('chooseThemes', () => {
  it('names what the month was about, most frequent first, a photo each', () => {
    const media = collectMedia(september())
    const themes = chooseThemes(media, scoresOf(media))
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

describe('chooseBeats', () => {
  const beatsOf = (entries, used = new Set()) => {
    const media = collectMedia(entries)
    return chooseBeats(media.filter((m) => m.type === 'image'), scoresOf(media), used).map((b) => b.map((p) => p.url))
  }

  it('keeps an album together, up to four photos, in its author’s order', () => {
    expect(beatsOf({ memories: [memory('trip', 3, ['t1', 't2', 't3', 't4', 't5'])] })).toEqual([['t1', 't2', 't3', 't4']])
  })

  it('pulls the snapshots of one day into one collage, and leaves albums and other days alone', () => {
    const beats = beatsOf({
      memories: [memory('album', 14, ['a1', 'a2'])],
      moments: [
        { ...moment('s1', 14, ['s1']), date: new Date(2026, 8, 14, 9) },
        { ...moment('s2', 14, ['s2']), date: new Date(2026, 8, 14, 15) },
        { ...moment('s3', 14, ['s3']), date: new Date(2026, 8, 14, 18) },
        moment('other', 20, ['o1']),
      ],
    })
    expect(beats).toEqual([['s1'], ['a1', 'a2'], ['s2', 's3'], ['o1']])
  })

  it('leaves out what the story has already used, and marks what it takes', () => {
    const used = new Set(['t1'])
    expect(beatsOf({ memories: [memory('trip', 3, ['t1', 't2'])] }, used)).toEqual([['t2']])
    expect(used.has('t2')).toBe(true)
  })

  it('spreads a busy month over its days before taking a second entry of any', () => {
    const moments = [
      ...Array.from({ length: 6 }, (_, i) => ({ ...moment(`h${i}`, 3, [`h${i}`], { caption: 'holiday' }), date: new Date(2026, 8, 3, 8 + i) })),
      moment('later', 25, ['later']),
    ]
    const media = collectMedia({ moments })
    const beats = chooseBeats(media, scoresOf(media), new Set(), 2)
    expect(beats.flat().map((p) => p.url)).toContain('later')
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
    const bestOf = buildBestOf({ month: '2026-09', ...september() })

    expect(bestOf).toMatchObject({ version: BEST_OF_VERSION, month: '2026-09', counts: { photos: 10, videos: 2 } })
    const kinds = bestOf.slides.map((s) => s.kind)
    expect(kinds.slice(0, 3)).toEqual(['intro', 'count', 'themes'])
    expect(kinds.at(-1)).toBe('outro')
    expect(kinds).toContain('video')
    expect(kinds).toContain('collage')

    // Each award is announced, then shown.
    const intro = kinds.indexOf('awardIntro')
    expect(kinds[intro + 1]).toBe('award')
    expect(bestOf.slides[intro + 1]).toMatchObject({ award: 'place', place: 'Zell am See' })
    expect(bestOf.awards).toEqual(['place', 'story'])

    // The moments between the cards run in the order they happened, up to the
    // last look at what did not make it.
    const end = kinds.includes('dontForget') ? kinds.indexOf('dontForget') : kinds.length
    const days = bestOf.slides.slice(0, end).filter((s) => ['photo', 'video', 'collage'].includes(s.kind)).map((s) => s.day)
    expect(days.length).toBeGreaterThan(3)
    expect([...days].sort()).toEqual(days)
  })

  it('makes an album a collage, and moves single photos in turn', () => {
    const bestOf = buildBestOf({ month: '2026-09', ...september() })
    const collage = bestOf.slides.find((s) => s.kind === 'collage' && s.day === '2026-09-20')
    expect(collage).toMatchObject({ layout: 'duo', caption: 'Memory bday', location: 'Home' })
    expect(collage.media.map((m) => m.url)).toEqual(['bday1', 'bday2'])

    const moves = bestOf.slides.filter((s) => s.kind === 'photo' || s.kind === 'dontForget').map((s) => s.motion)
    expect(moves.length).toBeGreaterThan(1)
    for (const move of moves) expect(MOTIONS).toContain(move)
    for (let i = 1; i < moves.length; i++) expect(moves[i]).not.toBe(moves[i - 1])
  })

  it('varies the layout of collages of the same size', () => {
    const memories = Array.from({ length: 4 }, (_, i) => memory(`trip${i}`, 2 + i * 5, [`a${i}`, `b${i}`, `c${i}`]))
    const bestOf = buildBestOf({ month: '2026-09', memories })
    const layouts = bestOf.slides.filter((s) => s.kind === 'collage').map((s) => s.layout)
    expect(layouts.length).toBeGreaterThan(1)
    for (let i = 1; i < layouts.length; i++) expect(layouts[i]).not.toBe(layouts[i - 1])
  })

  it('never shows a photo twice in the run of the month', () => {
    const bestOf = buildBestOf({ month: '2026-09', ...september() })
    const shown = bestOf.slides
      .filter((s) => ['photo', 'video', 'award', 'dontForget', 'collage'].includes(s.kind))
      .flatMap((s) => (Array.isArray(s.media) ? s.media : [s.media]).map((m) => m.url))
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
