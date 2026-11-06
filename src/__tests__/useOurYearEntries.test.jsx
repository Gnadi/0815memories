/* The Our Year reveal, as the hook drives it.

   The reveal used to be two writes: the chapter's timestamp, then — once that
   write was confirmed — `revealed` on both entries. Firestore reports a local
   write to its listeners before the server confirms it, so the chapter's new
   snapshot re-ran the effect, cancelled the old one, and the entries were
   never opened. The chapter said "revealed"; the rules kept the partner's
   answers shut, for good. These tests stage exactly that order. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const listeners = {}
const revealAnswers = vi.fn()

vi.mock('../config/firebase', () => ({ db: {} }))
vi.mock('../utils/devLog', () => ({ devError: vi.fn() }))
vi.mock('../services/ourYear', () => ({
  subscribeEntry: vi.fn((chapterId, kind, uid, _key, onData, onError) => {
    listeners[uid] = { onData, onError }
    return () => { delete listeners[uid] }
  }),
  revealAnswers: (...args) => revealAnswers(...args),
  writeEntry: vi.fn(),
  markSubmitted: vi.fn(),
}))

import { useOurYearEntries } from '../hooks/useOurYear'

const A = 'uid-a'
const B = 'uid-b'

const chapter = (overrides = {}) => ({
  id: 'ch1',
  participantUids: [A, B],
  reflectionSubmittedBy: [A, B],
  ...overrides,
})

const entry = (uid, overrides = {}) => ({ id: `ch1_reflection_${uid}`, authorUid: uid, submitted: true, revealed: false, answers: {}, ...overrides })

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.clearAllMocks()
  for (const k of Object.keys(listeners)) delete listeners[k]
})

describe('useOurYearEntries — the reveal', () => {
  it('opens both entries even when the chapter snapshot arrives before the write is confirmed', async () => {
    const write = deferred()
    revealAnswers.mockReturnValue(write.promise)
    const { result, rerender } = renderHook(({ ch }) => useOurYearEntries(ch, 'reflection', A, {}), {
      initialProps: { ch: chapter() },
    })
    act(() => listeners[A].onData(entry(A)))

    expect(revealAnswers).toHaveBeenCalledTimes(1)
    expect(revealAnswers).toHaveBeenCalledWith('ch1', 'reflection', [A, B], { chapterRevealed: false })

    // Firestore's local echo: chapter and own entry both read as revealed
    // before the server has said yes.
    rerender({ ch: chapter({ reflectionsRevealedAt: 'local' }) })
    act(() => listeners[A].onData(entry(A, { revealed: true })))

    // Not yet: the rules would refuse this read until the batch has landed.
    expect(listeners[B]).toBeUndefined()

    await act(async () => write.resolve())
    expect(revealAnswers).toHaveBeenCalledTimes(1)
    expect(listeners[B]).toBeDefined()
    act(() => listeners[B].onData(entry(B, { revealed: true, answers: { q1: 'hi' } })))
    expect(result.current.partner.answers).toEqual({ q1: 'hi' })
    expect(result.current.revealed).toBe(true)
  })

  it('repairs a chapter that says revealed while the entries were never opened', async () => {
    revealAnswers.mockResolvedValue()
    renderHook(() => useOurYearEntries(chapter({ reflectionsRevealedAt: 'then' }), 'reflection', A, {}))
    await act(async () => listeners[A].onData(entry(A)))
    expect(revealAnswers).toHaveBeenCalledWith('ch1', 'reflection', [A, B], { chapterRevealed: true })
  })

  it('does nothing before both have handed in', async () => {
    renderHook(() => useOurYearEntries(chapter({ reflectionSubmittedBy: [A] }), 'reflection', A, {}))
    await act(async () => listeners[A].onData(entry(A)))
    expect(revealAnswers).not.toHaveBeenCalled()
    expect(listeners[B]).toBeUndefined()
  })

  it('does nothing once its own entry is revealed and the partner can be read', async () => {
    renderHook(() => useOurYearEntries(chapter({ reflectionsRevealedAt: 'then' }), 'reflection', A, {}))
    await act(async () => listeners[A].onData(entry(A, { revealed: true })))
    expect(revealAnswers).not.toHaveBeenCalled()
    expect(listeners[B]).toBeDefined()
  })

  it('tries once more when the partner is still refused, and then stops', async () => {
    revealAnswers.mockResolvedValue()
    renderHook(() => useOurYearEntries(chapter({ reflectionsRevealedAt: 'then' }), 'reflection', A, {}))
    await act(async () => listeners[A].onData(entry(A, { revealed: true })))
    await act(async () => listeners[B].onError({ code: 'permission-denied' }))
    expect(revealAnswers).toHaveBeenCalledTimes(1)
    await act(async () => listeners[B].onError({ code: 'permission-denied' }))
    expect(revealAnswers).toHaveBeenCalledTimes(1)
  })

  it('does not retry a refused reveal in a loop', async () => {
    revealAnswers.mockRejectedValue(new Error('permission-denied'))
    const { rerender } = renderHook(({ ch }) => useOurYearEntries(ch, 'reflection', A, {}), {
      initialProps: { ch: chapter() },
    })
    await act(async () => listeners[A].onData(entry(A)))
    rerender({ ch: chapter() })
    await act(async () => {})
    expect(revealAnswers).toHaveBeenCalledTimes(1)
  })
})
