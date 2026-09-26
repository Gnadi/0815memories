import { describe, it, expect } from 'vitest'
import {
  collectEntries,
  suggestMonths,
  entriesInMonth,
  buildScrapbook,
  yearSpan,
  MAX_PAGES,
} from '../utils/autoScrapbook'

const memory = (id, date, n, title = id) => ({
  id,
  title,
  date,
  images: Array.from({ length: n }, (_, i) => `${id}-${i}.enc`),
})
const moment = (id, date, caption = id) => ({ id, caption, date, images: [`${id}.enc`] })

const photosOn = (page) => page.elements.filter((e) => e.type === 'photo')
const fixed = () => 0

describe('collectEntries', () => {
  it('merges memories and moments oldest first and skips entries without photos', () => {
    const entries = collectEntries(
      [memory('m1', new Date(2026, 3, 10), 2), { id: 'empty', title: 'x', date: new Date(2026, 3, 1), images: [] }],
      [moment('s1', { toDate: () => new Date(2026, 3, 5) })]
    )
    expect(entries.map((e) => e.id)).toEqual(['moment:s1', 'memory:m1'])
    expect(entries[1].photos).toHaveLength(2)
    expect(entries[0].title).toBe('s1')
  })

  it('falls back to the legacy single imageUrl', () => {
    const [entry] = collectEntries([{ id: 'old', title: 'Old', date: new Date(2020, 0, 1), imageUrl: 'old.enc' }], [])
    expect(entry.photos).toEqual([{ url: 'old.enc', thumbUrl: '' }])
  })
})

describe('suggestMonths', () => {
  it('offers months with enough photos, newest first, and flags the busiest', () => {
    const entries = collectEntries(
      [
        memory('sep', new Date(2026, 8, 3), 4),
        memory('aug', new Date(2026, 7, 3), 9),
        memory('jul', new Date(2026, 6, 3), 2), // too few
      ],
      []
    )
    const s = suggestMonths(entries)
    expect(s.map((m) => [m.year, m.month])).toEqual([[2026, 8], [2026, 7]])
    expect(s.find((m) => m.busiest).month).toBe(7)
    expect(s[0].preview).toHaveLength(3)
  })

  it('keeps an old busiest month even when newer months fill the list', () => {
    const recent = Array.from({ length: 8 }, (_, i) => memory(`r${i}`, new Date(2026, i, 2), 4))
    const holiday = memory('holiday', new Date(2023, 6, 1), 20)
    const s = suggestMonths(collectEntries([...recent, holiday], []))
    expect(s).toHaveLength(6)
    expect(s.some((m) => m.year === 2023 && m.busiest)).toBe(true)
  })

  it('returns nothing for a family without photos', () => {
    expect(suggestMonths([])).toEqual([])
  })
})

describe('entriesInMonth', () => {
  it('filters by calendar month', () => {
    const entries = collectEntries([memory('a', new Date(2026, 1, 28), 1), memory('b', new Date(2026, 2, 1), 1)], [])
    expect(entriesInMonth(entries, 2026, 1).map((e) => e.id)).toEqual(['memory:a'])
  })
})

describe('buildScrapbook', () => {
  it('starts with a filled cover carrying the title and subtitle', () => {
    const entries = collectEntries([memory('small', new Date(2026, 8, 1), 2), memory('big', new Date(2026, 8, 5), 5)], [])
    const { pages, coverImageUrl } = buildScrapbook(entries, { title: 'September', subtitle: '2026', random: fixed })
    const cover = pages[0]
    const texts = cover.elements.filter((e) => e.type === 'text').map((e) => e.text)
    expect(texts).toEqual(['SEPTEMBER', '2026'])
    expect(coverImageUrl).toBe('big-0.enc')
    expect(photosOn(cover)[0]).toMatchObject({ url: 'big-0.enc', isSlot: false })
  })

  it('gives a multi-photo entry its own captioned page with every photo placed', () => {
    const entries = collectEntries([memory('trip', new Date(2026, 8, 1), 3, 'Zoo')], [])
    const { pages } = buildScrapbook(entries, { title: 'x', formatDate: () => '1.9.', random: fixed })
    expect(pages).toHaveLength(2)
    expect(photosOn(pages[1]).map((p) => p.url)).toEqual(['trip-0.enc', 'trip-1.enc', 'trip-2.enc'])
    expect(pages[1].elements.find((e) => e.type === 'text').text).toBe('Zoo · 1.9.')
  })

  it('splits a large entry evenly instead of leaving one photo alone', () => {
    const entries = collectEntries([memory('big', new Date(2026, 8, 1), 7)], [])
    const { pages } = buildScrapbook(entries, { title: 'x', random: fixed })
    expect(pages.slice(1).map((p) => photosOn(p).length)).toEqual([4, 3])
  })

  it('gathers single-photo moments onto shared polaroid pages', () => {
    const moments = Array.from({ length: 6 }, (_, i) => moment(`s${i}`, new Date(2026, 8, i + 1)))
    const { pages } = buildScrapbook(collectEntries([], moments), { title: 'x', random: fixed })
    expect(pages.slice(1).map((p) => photosOn(p).length)).toEqual([4, 2])
    const first = photosOn(pages[1])[0]
    expect(first).toMatchObject({ polaroid: true, caption: 's0', url: 's0.enc' })
  })

  it('keeps photos inside the 800 × 600 canvas', () => {
    const entries = collectEntries(
      [1, 2, 3, 4, 5, 6].map((n) => memory(`m${n}`, new Date(2026, 8, n), n)),
      [moment('a', new Date(2026, 8, 20))]
    )
    const { pages } = buildScrapbook(entries, { title: 'x', random: fixed })
    for (const page of pages.slice(1)) {
      for (const el of page.elements) {
        expect(el.x).toBeGreaterThanOrEqual(0)
        expect(el.y).toBeGreaterThanOrEqual(0)
        expect(el.x + el.width).toBeLessThanOrEqual(800)
        expect(el.y + el.height).toBeLessThanOrEqual(600)
      }
    }
  })

  it('caps the number of pages', () => {
    const entries = collectEntries(Array.from({ length: 80 }, (_, i) => memory(`m${i}`, new Date(2026, 0, 1, i), 2)), [])
    expect(buildScrapbook(entries, { title: 'x', random: fixed }).pages).toHaveLength(MAX_PAGES)
  })
})

describe('yearSpan', () => {
  it('shows a single year or a range', () => {
    expect(yearSpan(collectEntries([memory('a', new Date(2025, 0, 1), 1)], []))).toBe('2025')
    expect(yearSpan(collectEntries([memory('a', new Date(2023, 0, 1), 1), memory('b', new Date(2025, 0, 1), 1)], []))).toBe('2023 – 2025')
  })
})
