import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const photos = []
vi.mock('../hooks/useMemoryPhotos', () => ({
  useMemoryPhotos: () => ({ photos, loading: false }),
}))

const { useHighlightSuggestions } = await import('../hooks/useHighlightSuggestions')

// The library arrives newest first, which is how useMemoryPhotos returns it.
const photo = (id, date) => ({ id, url: `${id}.enc`, thumbUrl: `${id}-t.enc`, memoryId: id, memoryTitle: id, date })

function setPhotos(list) {
  photos.length = 0
  photos.push(...list)
}

const NOW = new Date(2026, 6, 15) // 15 July 2026 — summer

const suggest = () => renderHook(() => useHighlightSuggestions('fam', null, { now: NOW })).result.current.suggestions

describe('useHighlightSuggestions', () => {
  it('offers nothing when there are too few photos to make a reel', () => {
    setPhotos([photo('a', new Date(2026, 1, 1)), photo('b', new Date(2026, 1, 2))])
    expect(suggest()).toEqual([])
  })

  it('offers this year, last year, the season and a busiest month once each has enough photos', () => {
    setPhotos([
      ...Array.from({ length: 4 }, (_, i) => photo(`jul26-${i}`, new Date(2026, 6, 2 + i))),
      ...Array.from({ length: 3 }, (_, i) => photo(`aug25-${i}`, new Date(2025, 7, 2 + i))),
    ])
    const kinds = suggest().map((s) => s.kind)
    expect(kinds).toContain('year')
    expect(kinds).toContain('season')
    expect(kinds).toContain('month')
    expect(kinds).toContain('recent')
  })

  it('scopes a year suggestion to that year', () => {
    // Newest first, the order useMemoryPhotos hands over.
    setPhotos([
      ...Array.from({ length: 3 }, (_, i) => photo(`y26-${i}`, new Date(2026, 2, 3 - i))),
      ...Array.from({ length: 3 }, (_, i) => photo(`y25-${i}`, new Date(2025, 2, 3 - i))),
    ])
    const thisYear = suggest().find((s) => s.kind === 'year' && s.params.year === 2026)
    // Reversed into oldest-first for playback, and nothing from 2025.
    expect(thisYear.shots.map((shot) => shot.url)).toEqual(['y26-2.enc', 'y26-1.enc', 'y26-0.enc'])
  })

  it('collects the current season across every year', () => {
    setPhotos([
      photo('s26', new Date(2026, 6, 1)),
      photo('s25', new Date(2025, 7, 1)),
      photo('s24', new Date(2024, 5, 1)),
      photo('w26', new Date(2026, 0, 1)),
    ])
    const season = suggest().find((s) => s.kind === 'season')
    expect(season.params.season).toBe('summer')
    expect(season.shots.map((shot) => shot.url)).not.toContain('w26.enc')
    expect(season.shots).toHaveLength(3)
  })

  it('runs a reel oldest to newest, the way a story reads', () => {
    setPhotos([
      photo('newest', new Date(2026, 6, 3)),
      photo('middle', new Date(2026, 6, 2)),
      photo('oldest', new Date(2026, 6, 1)),
    ])
    const recent = suggest().find((s) => s.kind === 'recent')
    expect(recent.shots.map((shot) => shot.url)).toEqual(['oldest.enc', 'middle.enc', 'newest.enc'])
  })

  it('carries the thumbnail so suggestion cards do not pull full-size originals', () => {
    setPhotos(Array.from({ length: 3 }, (_, i) => photo(`p${i}`, new Date(2026, 6, 1 + i))))
    expect(suggest()[0].shots[0].thumbUrl).toMatch(/-t\.enc$/)
  })

  it('ignores photos whose memory has no usable date', () => {
    setPhotos([
      photo('a', null),
      photo('b', new Date('nonsense')),
      ...Array.from({ length: 3 }, (_, i) => photo(`ok${i}`, new Date(2026, 6, 1 + i))),
    ])
    const dated = suggest().filter((s) => s.kind !== 'recent')
    for (const suggestion of dated) {
      expect(suggestion.shots.map((s) => s.url)).not.toContain('a.enc')
      expect(suggestion.shots.map((s) => s.url)).not.toContain('b.enc')
    }
  })

  it('caps a reel so it stays watchable', () => {
    setPhotos(Array.from({ length: 40 }, (_, i) => photo(`p${i}`, new Date(2026, 6, 1))))
    for (const suggestion of suggest()) {
      expect(suggestion.shots.length).toBeLessThanOrEqual(14)
    }
  })
})
