/**
 * Tests for src/utils/anniversaryClient.js — the client-side helpers that
 * replaced the api/anniversary-cron.js Vercel cron.
 *
 * We mock firebase/firestore so no real connection is needed and we can
 * assert that the query is built with the correct date window.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetDocs = vi.fn()
const mockCollection = vi.fn((_db, name) => ({ __collection: name }))
const mockQuery = vi.fn((...args) => ({ __query: args }))
const mockWhere = vi.fn((field, op, value) => ({ __where: [field, op, value] }))

vi.mock('firebase/firestore', () => ({
  collection: (...a) => mockCollection(...a),
  query: (...a) => mockQuery(...a),
  where: (...a) => mockWhere(...a),
  getDocs: (...a) => mockGetDocs(...a),
  Timestamp: { fromDate: (d) => ({ __ts: d }) },
}))

const {
  todayDateKey,
  threeYearsAgoWindow,
  countAnniversaryMemories,
  buildAnniversaryQueueDoc,
} = await import('../utils/anniversaryClient.js')

describe('todayDateKey', () => {
  it('zero-pads single-digit months and days', () => {
    expect(todayDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('formats a typical date correctly', () => {
    expect(todayDateKey(new Date(2026, 4, 8))).toBe('2026-05-08')
  })
})

describe('threeYearsAgoWindow', () => {
  it('returns the same calendar day three years ago, with full-day bounds', () => {
    const now = new Date(2026, 4, 8, 14, 30) // May 8, 2026, 14:30
    const { start, end, year } = threeYearsAgoWindow(now)
    expect(year).toBe(2023)
    expect(start.getFullYear()).toBe(2023)
    expect(start.getMonth()).toBe(4)
    expect(start.getDate()).toBe(8)
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(end.getHours()).toBe(23)
    expect(end.getMinutes()).toBe(59)
    expect(end.getSeconds()).toBe(59)
  })
})

describe('countAnniversaryMemories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no memories match', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, size: 0 })
    const result = await countAnniversaryMemories({}, 'family-A', new Date(2026, 4, 8))
    expect(result).toBeNull()
  })

  it('returns count and year when memories exist', async () => {
    mockGetDocs.mockResolvedValue({ empty: false, size: 4 })
    const result = await countAnniversaryMemories({}, 'family-A', new Date(2026, 4, 8))
    expect(result).toEqual({ count: 4, year: 2023 })
  })

  it('builds the query with familyId equality and a 3-years-ago day window', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, size: 0 })
    await countAnniversaryMemories({}, 'family-A', new Date(2026, 4, 8))

    const whereCalls = mockWhere.mock.calls
    expect(whereCalls).toHaveLength(3)
    expect(whereCalls[0]).toEqual(['familyId', '==', 'family-A'])
    expect(whereCalls[1][0]).toBe('date')
    expect(whereCalls[1][1]).toBe('>=')
    expect(whereCalls[2][0]).toBe('date')
    expect(whereCalls[2][1]).toBe('<=')

    const startTs = whereCalls[1][2]
    const endTs = whereCalls[2][2]
    expect(startTs.__ts.getFullYear()).toBe(2023)
    expect(startTs.__ts.getDate()).toBe(8)
    expect(endTs.__ts.getFullYear()).toBe(2023)
    expect(endTs.__ts.getHours()).toBe(23)
  })
})

describe('buildAnniversaryQueueDoc', () => {
  it('uses singular form for exactly one memory', () => {
    const doc = buildAnniversaryQueueDoc('family-A', 1, 2023)
    expect(doc.body).toContain('1 Erinnerung')
    expect(doc.body).not.toContain('Erinnerungen')
  })

  it('uses plural form for multiple memories', () => {
    const doc = buildAnniversaryQueueDoc('family-A', 4, 2023)
    expect(doc.body).toContain('4 Erinnerungen')
  })

  it('includes the family id, anniversary URL, and German title', () => {
    const doc = buildAnniversaryQueueDoc('family-A', 2, 2023)
    expect(doc.familyId).toBe('family-A')
    expect(doc.url).toBe('/timeline?filter=onthisday')
    expect(doc.title).toContain('3 Jahre')
  })
})
