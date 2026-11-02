/* Making and finding the monthly best-of (hooks/useBestOf.js): who saves it,
   that two screens asking at once make it once, and what the moments row
   offers before and after anyone has made it. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

vi.mock('../config/firebase', () => ({ db: { type: 'test' }, auth: null }))

const h = vi.hoisted(() => ({ saved: new Map(), entries: null, lastYear: null, listeners: new Set() }))

// The month asked for, and the same month a year before.
const getMonthEntries = vi.fn(async (familyId, key, month) => {
  if (month !== '2025-09') return h.entries
  if (h.lastYear instanceof Error) throw h.lastYear
  return h.lastYear ?? { memories: [], moments: [] }
})
const saveBestOf = vi.fn(async (familyId, key, bestOf) => {
  h.saved.set(bestOf.month, bestOf)
  for (const listener of h.listeners) listener()
})
vi.mock('../services/bestOf', () => ({
  getMonthEntries: (...args) => getMonthEntries(...args),
  saveBestOf: (...args) => saveBestOf(...args),
  getBestOf: async (familyId, key, month) => {
    const doc = h.saved.get(month)
    return doc ? { month, version: doc.version, doc } : null
  },
  subscribeBestOfs: (familyId, key, onData) => {
    const emit = () => onData([...h.saved.values()].map((doc) => ({ month: doc.month, version: doc.version, doc })))
    h.listeners.add(emit)
    emit()
    return () => h.listeners.delete(emit)
  },
}))
import { makeBestOf, useBestOfMonth, useCurrentBestOf } from '../hooks/useBestOf'

const at = (d) => new Date(2026, 8, d, 12)
const moment = (id, d, images) => ({ id, date: at(d), caption: id, images })
const SEPTEMBER = {
  memories: [],
  moments: [moment('a', 2, ['a1', 'a2']), moment('b', 9, ['b1', 'b2']), moment('c', 20, ['c1', 'c2'])],
}
const TOO_LITTLE = { memories: [], moments: [moment('a', 2, ['a1'])] }

const family = { familyId: 'fam', encryptionKey: null }

beforeEach(() => {
  h.saved.clear()
  h.entries = SEPTEMBER
  h.lastYear = null
  getMonthEntries.mockClear()
  saveBestOf.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('makeBestOf', () => {
  it('saves what an admin’s device makes, and nothing a viewer’s does', async () => {
    const viewer = await makeBestOf({ ...family, month: '2026-09', isAdmin: false })
    expect(viewer.month).toBe('2026-09')
    expect(saveBestOf).not.toHaveBeenCalled()

    const admin = await makeBestOf({ ...family, month: '2026-09', isAdmin: true })
    expect(saveBestOf).toHaveBeenCalledTimes(1)
    // The same month, the same story, whoever made it.
    expect(admin).toEqual(viewer)
  })

  it('makes a month once for everyone asking at the same time', async () => {
    const [first, second] = await Promise.all([
      makeBestOf({ ...family, month: '2026-09', isAdmin: true }),
      makeBestOf({ ...family, month: '2026-09', isAdmin: true }),
    ])
    expect(first).toBe(second)
    // The month and the same month a year before, once each.
    expect(getMonthEntries.mock.calls.map((call) => call[2])).toEqual(['2026-09', '2025-09'])
    expect(saveBestOf).toHaveBeenCalledTimes(1)
  })

  it('looks back at the same month a year before, and goes without when it cannot read it', async () => {
    h.lastYear = { memories: [], moments: [{ id: 'old', date: new Date(2025, 8, 4, 12), caption: 'old', images: ['o1'] }] }
    const withIt = await makeBestOf({ ...family, month: '2026-09', isAdmin: false })
    expect(withIt.slides.find((s) => s.kind === 'yearAgo')).toMatchObject({ month: '2025-09', photos: 1 })

    h.lastYear = new Error('offline')
    const without = await makeBestOf({ ...family, month: '2026-09', isAdmin: false })
    expect(without).not.toBeNull()
    expect(without.slides.some((s) => s.kind === 'yearAgo')).toBe(false)
  })

  it('makes nothing of a month with too little, and saves nothing', async () => {
    h.entries = TOO_LITTLE
    await expect(makeBestOf({ ...family, month: '2026-09', isAdmin: true })).resolves.toBeNull()
    expect(saveBestOf).not.toHaveBeenCalled()
  })
})

describe('useBestOfMonth', () => {
  it('plays a saved best-of without making it again', async () => {
    await makeBestOf({ ...family, month: '2026-09', isAdmin: true })
    getMonthEntries.mockClear()

    const { result } = renderHook(() => useBestOfMonth({ ...family, isAdmin: false, month: '2026-09' }))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.bestOf.month).toBe('2026-09')
    expect(getMonthEntries).not.toHaveBeenCalled()
  })

  it('makes one nobody has made yet, and says so when the month is too thin', async () => {
    const { result } = renderHook(() => useBestOfMonth({ ...family, isAdmin: true, month: '2026-09' }))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(saveBestOf).toHaveBeenCalledTimes(1)

    h.entries = TOO_LITTLE
    const thin = renderHook(() => useBestOfMonth({ ...family, isAdmin: true, month: '2026-08' }))
    await waitFor(() => expect(thin.result.current.status).toBe('empty'))
  })

  it('puts it together again for an admin who asks', async () => {
    const { result } = renderHook(() => useBestOfMonth({ ...family, isAdmin: true, month: '2026-09' }))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    getMonthEntries.mockClear()

    act(() => result.current.remake())
    await waitFor(() => expect(getMonthEntries).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(saveBestOf).toHaveBeenCalledTimes(2)
  })
})

describe('useCurrentBestOf', () => {
  const NOW = new Date(2026, 9, 3, 9)

  it('offers last month while nobody has made it, and an admin’s device makes it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { result } = renderHook(() => useCurrentBestOf({ ...family, isAdmin: true, now: NOW }))
    await waitFor(() => expect(result.current).toMatchObject({ month: '2026-09', saved: false }))
    expect(result.current.cover).toEqual({ url: 'a1' })

    await act(() => vi.advanceTimersByTimeAsync(5000))
    await waitFor(() => expect(result.current).toMatchObject({ month: '2026-09', saved: true }))
    expect(saveBestOf).toHaveBeenCalledTimes(1)
  })

  it('leaves the making to an admin, and offers nothing for a thin month', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const viewer = renderHook(() => useCurrentBestOf({ ...family, isAdmin: false, now: NOW }))
    await waitFor(() => expect(viewer.result.current).toMatchObject({ saved: false }))
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(saveBestOf).not.toHaveBeenCalled()

    h.entries = TOO_LITTLE
    const thin = renderHook(() => useCurrentBestOf({ ...family, familyId: 'other', isAdmin: true, now: NOW }))
    await waitFor(() => expect(getMonthEntries).toHaveBeenCalledWith('other', null, '2026-09'))
    expect(thin.result.current).toBeNull()
  })
})
