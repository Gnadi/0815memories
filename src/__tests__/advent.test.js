import { describe, it, expect } from 'vitest'
import {
  ADVENT_DOORS,
  adventCandidates,
  adventLayout,
  adventYear,
  assignAdventDoors,
  daysUntilAdvent,
  doorOpensAt,
  isAdventSeason,
  isDoorOpenable,
  yearsAgo,
} from '../utils/advent'

const at = (y, m, d) => new Date(y, m - 1, d, 12)
const memory = (id, date, extra = {}) => ({ id, date, images: ['img'], ...extra })

describe('advent dates', () => {
  it('belongs to December’s year, and in January still to the last one', () => {
    expect(adventYear(at(2026, 12, 3))).toBe(2026)
    expect(adventYear(at(2027, 1, 2))).toBe(2026)
    expect(adventYear(at(2026, 11, 6))).toBe(2026)
  })

  it('opens a door at midnight of its day, not before', () => {
    expect(isDoorOpenable(2026, 5, new Date(2026, 11, 4, 23, 59))).toBe(false)
    expect(isDoorOpenable(2026, 5, new Date(2026, 11, 5, 0, 0))).toBe(true)
    expect(isDoorOpenable(2026, 24, at(2027, 1, 3))).toBe(true)
    expect(doorOpensAt(2026, 1)).toEqual(new Date(2026, 11, 1))
  })

  it('shows on the home page from 24 November to 6 January', () => {
    expect(isAdventSeason(at(2026, 11, 23))).toBe(false)
    expect(isAdventSeason(at(2026, 11, 24))).toBe(true)
    expect(isAdventSeason(at(2026, 12, 31))).toBe(true)
    expect(isAdventSeason(at(2027, 1, 6))).toBe(true)
    expect(isAdventSeason(at(2027, 1, 7))).toBe(false)
  })

  it('counts the days to the first door', () => {
    expect(daysUntilAdvent(at(2026, 11, 24))).toBe(7)
    expect(daysUntilAdvent(at(2026, 11, 30))).toBe(1)
    expect(daysUntilAdvent(at(2026, 12, 1))).toBe(0)
    expect(daysUntilAdvent(at(2027, 1, 2))).toBe(0)
  })
})

describe('adventCandidates', () => {
  it('takes only what is dated before the first door, each entry once', () => {
    const candidates = adventCandidates({
      memories: [memory('a', at(2025, 6, 1)), memory('a', at(2025, 6, 1)), memory('late', at(2026, 12, 2))],
      moments: [{ id: 'a', date: { toDate: () => at(2024, 12, 6) } }],
    }, 2026)
    expect(candidates.map((c) => c.key)).toEqual(['memory:a', 'moment:a'])
    expect(candidates[1].photo).toBe(false)
  })
})

describe('assignAdventDoors', () => {
  const many = Array.from({ length: 40 }, (_, i) => memory(`m${i}`, at(2025, 1 + (i % 11), 1 + (i % 28))))

  it('has 24 doors, and no entry behind two of them', () => {
    const doors = assignAdventDoors(adventCandidates({ memories: many }, 2026), { year: 2026, seed: 'fam' })
    expect(doors).toHaveLength(ADVENT_DOORS)
    const keys = doors.map((d) => d.entry?.key)
    expect(keys.every(Boolean)).toBe(true)
    expect(new Set(keys).size).toBe(ADVENT_DOORS)
  })

  it('is the same calendar on every device, whatever order the entries came in', () => {
    const one = assignAdventDoors(adventCandidates({ memories: many }, 2026), { year: 2026, seed: 'fam' })
    const two = assignAdventDoors(adventCandidates({ memories: [...many].reverse() }, 2026), { year: 2026, seed: 'fam' })
    expect(two.map((d) => d.entry.key)).toEqual(one.map((d) => d.entry.key))
  })

  it('is a different calendar for another year', () => {
    const one = assignAdventDoors(adventCandidates({ memories: many }, 2026), { year: 2026, seed: 'fam' })
    const two = assignAdventDoors(adventCandidates({ memories: many }, 2027), { year: 2027, seed: 'fam' })
    expect(two.map((d) => d.entry.key)).not.toEqual(one.map((d) => d.entry.key))
  })

  it('puts an entry from a door’s own day behind it, photo first', () => {
    const memories = [
      ...many,
      memory('dec6-text', at(2023, 12, 6), { images: [] }),
      memory('dec6-photo', at(2022, 12, 6)),
      memory('dec13', at(2024, 12, 13)),
    ]
    const doors = assignAdventDoors(adventCandidates({ memories }, 2026), { year: 2026, seed: 'fam' })
    expect(doors[5]).toMatchObject({ day: 6, onThisDay: true, entry: { id: 'dec6-photo' } })
    expect(doors[12]).toMatchObject({ day: 13, onThisDay: true, entry: { id: 'dec13' } })
    expect(doors[0].onThisDay).toBe(false)
  })

  it('gives Christmas Eve the featured memory when its own day has none', () => {
    const memories = [...many, memory('featured', at(2025, 8, 15), { featured: true })]
    const doors = assignAdventDoors(adventCandidates({ memories }, 2026), { year: 2026, seed: 'fam' })
    expect(doors[23].entry.id).toBe('featured')
  })

  it('prefers photos, and leaves doors empty when there is too little', () => {
    const memories = [memory('photo', at(2025, 3, 1)), memory('text', at(2025, 3, 2), { images: [] })]
    const doors = assignAdventDoors(adventCandidates({ memories }, 2026), { year: 2026, seed: 'x' })
    const filled = doors.filter((d) => d.entry)
    expect(filled.map((d) => d.entry.id)).toEqual(['photo', 'text'])
    expect(doors.filter((d) => !d.entry)).toHaveLength(22)
  })
})

describe('adventLayout', () => {
  it('hangs every door once, the big ones early enough to be packed around', () => {
    const layout = adventLayout({ year: 2026, seed: 'fam' })
    expect([...layout].sort((a, b) => a - b)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1))
    expect(layout.indexOf(6)).toBe(4)
    expect(layout.indexOf(24)).toBe(10)
    expect(adventLayout({ year: 2026, seed: 'fam' })).toEqual(layout)
  })
})

it('counts the years since an entry', () => {
  expect(yearsAgo(at(2023, 12, 6), 2026)).toBe(3)
})
