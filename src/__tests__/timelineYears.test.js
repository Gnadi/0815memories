/* How many queries the Smart Timeline's year list costs.

   It counted every year from the oldest memory to the newest, in parallel. One
   memory with a mistyped year — 0202 for 2020, which a date field accepts —
   made that 1,824 count queries, and the timeline never finished loading. The
   newest COUNTED_YEARS are still counted at once; anything older is walked one
   read per year that has memories. timelineRules.test.js checks the answers
   against the emulator; this checks the cost, on a small in-memory stand-in. */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ dates: [], counts: 0, reads: 0, ascFails: false }))

vi.mock('../config/firebase', () => ({ db: {} }))
vi.mock('../hooks/useMemories', () => ({ decryptMemory: async (_key, data) => data }))
vi.mock('firebase/firestore', () => {
  const stamp = (date) => ({ toDate: () => date, ms: date.getTime() })
  const run = (parts) => {
    let rows = h.dates.map((date) => ({ date: stamp(date) }))
    for (const p of parts) {
      if (p.kind !== 'where' || p.field !== 'date') continue
      rows = rows.filter(({ date }) =>
        p.op === '>=' ? date.ms >= p.value.ms : p.op === '<' ? date.ms < p.value.ms : true)
    }
    const order = parts.find((p) => p.kind === 'orderBy')
    if (order) rows.sort((a, b) => (order.dir === 'desc' ? b.date.ms - a.date.ms : a.date.ms - b.date.ms))
    const cap = parts.find((p) => p.kind === 'limit')
    return cap ? rows.slice(0, cap.n) : rows
  }
  return {
    collection: () => ({ kind: 'collection' }),
    query: (...parts) => parts,
    where: (field, op, value) => ({ kind: 'where', field, op, value }),
    orderBy: (_field, dir = 'asc') => ({ kind: 'orderBy', dir }),
    limit: (n) => ({ kind: 'limit', n }),
    Timestamp: { fromDate: stamp },
    onSnapshot: () => () => {},
    getDocs: async (parts) => {
      if (h.ascFails && parts.some((p) => p.kind === 'orderBy' && p.dir === 'asc')) {
        throw Object.assign(new Error('The query requires an index'), { code: 'failed-precondition' })
      }
      h.reads++
      const rows = run(parts)
      return { empty: rows.length === 0, docs: rows.map((row) => ({ data: () => row })) }
    },
    getCountFromServer: async (parts) => {
      h.counts++
      return { data: () => ({ count: run(parts).length }) }
    },
  }
})

import { fetchTimelineYears, COUNTED_YEARS } from '../hooks/useTimeline'

const on = (year, month = 5) => {
  const date = new Date(2000, 0, 1, 12)
  date.setFullYear(year, month, 1)
  return date
}

beforeEach(() => {
  h.dates = []
  h.counts = 0
  h.reads = 0
  h.ascFails = false
})

describe('fetchTimelineYears', () => {
  it('counts no more than COUNTED_YEARS years, and walks the rest a read at a time', async () => {
    h.dates = [on(2025), on(2024), on(202)]

    expect(await fetchTimelineYears({}, 'fam')).toEqual([2025, 2024, 202])
    expect(h.counts).toBe(COUNTED_YEARS)
    // Newest, oldest, and one step back to 202 — not 1,824 counts.
    expect(h.reads).toBe(3)
  })

  it('counts only the years a family can have memories in', async () => {
    h.dates = [on(2025), on(2021), on(2020)]
    expect(await fetchTimelineYears({}, 'fam')).toEqual([2025, 2021, 2020])
    expect(h.counts).toBe(6)
    expect(h.reads).toBe(2)
  })

  it('still finds every year while the oldest-memory index is building', async () => {
    // It used to count the last 30 years and stop there.
    h.ascFails = true
    h.dates = [on(2025), on(1970), on(202)]
    expect(await fetchTimelineYears({}, 'fam')).toEqual([2025, 1970, 202])
    expect(h.counts).toBe(COUNTED_YEARS)
  })

  it('has no years, and asks nothing more, for a family without memories', async () => {
    expect(await fetchTimelineYears({}, 'fam')).toEqual([])
    expect(h.counts).toBe(0)
  })
})
