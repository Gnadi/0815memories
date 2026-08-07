import { useMemo } from 'react'
import { useMemoryPhotos } from './useMemoryPhotos'

// A reel wants enough shots to feel like a story and few enough to stay short.
const MIN_SHOTS = 3
const MAX_SHOTS = 14

const SEASONS = [
  { id: 'winter', months: [11, 0, 1] },
  { id: 'spring', months: [2, 3, 4] },
  { id: 'summer', months: [5, 6, 7] },
  { id: 'autumn', months: [8, 9, 10] },
]

function seasonOf(date) {
  return SEASONS.find((s) => s.months.includes(date.getMonth()))?.id ?? 'winter'
}

function take(photos, limit = MAX_SHOTS) {
  // Newest first is how the library arrives; a reel reads better oldest → newest.
  return photos.slice(0, limit).slice().reverse()
}

/**
 * "Create a video about…" — the ready-made reels offered on the create page.
 *
 * Everything is derived from photos the family already posted, so a new family
 * with three photos gets one honest suggestion rather than four empty ones.
 * Each suggestion carries its shots, so picking one is a single click.
 *
 * Shape: [{ id, kind, params, shots: [{ url, thumbUrl, memoryId }] }]
 * `kind` + `params` are what the UI translates; no user-facing text is built
 * here, which keeps the hook language-agnostic.
 */
export function useHighlightSuggestions(familyId, encryptionKey, { now } = {}) {
  const { photos, loading } = useMemoryPhotos(familyId, encryptionKey)
  // Pinned for the lifetime of the hook: a fresh `new Date()` on every render
  // would invalidate the memo below on every render.
  const clock = useMemo(() => now || new Date(), [now])

  const suggestions = useMemo(() => {
    const dated = photos.filter((p) => p.date instanceof Date && !Number.isNaN(p.date.getTime()))
    const out = []
    const seen = new Set()

    const push = (suggestion) => {
      if (suggestion.shots.length < MIN_SHOTS) return
      if (seen.has(suggestion.id)) return
      seen.add(suggestion.id)
      out.push(suggestion)
    }

    const asShots = (list) => list.map((p) => ({ url: p.url, thumbUrl: p.thumbUrl || null, memoryId: p.memoryId }))

    // 1. This year so far.
    const year = clock.getFullYear()
    push({
      id: `year-${year}`,
      kind: 'year',
      params: { year },
      shots: asShots(take(dated.filter((p) => p.date.getFullYear() === year))),
    })

    // 2. Last year, once there is a last year to look back on.
    push({
      id: `year-${year - 1}`,
      kind: 'year',
      params: { year: year - 1 },
      shots: asShots(take(dated.filter((p) => p.date.getFullYear() === year - 1))),
    })

    // 3. The season we are in, across every year — "our summers".
    const season = seasonOf(clock)
    push({
      id: `season-${season}`,
      kind: 'season',
      params: { season },
      shots: asShots(take(dated.filter((p) => seasonOf(p.date) === season))),
    })

    // 4. The busiest month on record — usually a holiday or a big event.
    const byMonth = new Map()
    for (const photo of dated) {
      const key = `${photo.date.getFullYear()}-${photo.date.getMonth()}`
      if (!byMonth.has(key)) byMonth.set(key, [])
      byMonth.get(key).push(photo)
    }
    const busiest = [...byMonth.entries()].sort((a, b) => b[1].length - a[1].length)[0]
    if (busiest) {
      const [key, list] = busiest
      const [y, m] = key.split('-').map(Number)
      push({
        id: `month-${key}`,
        kind: 'month',
        params: { year: y, month: m },
        shots: asShots(take(list)),
      })
    }

    // 5. Always offer the plain "everything, newest first" reel as a fallback.
    push({
      id: 'recent',
      kind: 'recent',
      params: {},
      shots: asShots(take(photos)),
    })

    return out
  }, [photos, clock])

  return { suggestions, photos, loading }
}
