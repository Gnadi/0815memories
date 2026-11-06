/* The editors' autosave (src/hooks/useAutosave.js).

   The case that lost work: a write for version A is on its way, the person
   types B, then A's write comes back. It used to mark the editor clean, which
   cancelled B's pending save; B stayed on screen, A was what a reload showed.
   The host below keeps its own "clean" flag the way the editors do — set from
   onSaved only when the written doc is still the one shown. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState, useCallback } from 'react'
import { useAutosave, AUTOSAVE_DELAY_MS } from '../hooks/useAutosave'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function useHost(write, onError) {
  const [doc, setDoc] = useState({ v: 'loaded' })
  const [saved, setSaved] = useState(doc)
  const onSaved = useCallback((savedDoc) => setSaved(savedDoc), [])
  const isDirty = saved !== doc
  const autosave = useAutosave({ doc, title: 't', isDirty, write, onSaved, onError })
  return { ...autosave, doc, isDirty, setDoc }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const settle = () => act(async () => { await Promise.resolve() })

describe('useAutosave', () => {
  it('saves a change made while an older write was on its way', async () => {
    const writes = []
    const write = vi.fn((doc) => {
      const d = deferred()
      writes.push({ doc, ...d })
      return d.promise
    })
    const { result } = renderHook(() => useHost(write))

    act(() => result.current.setDoc({ v: 'A' }))
    await act(async () => vi.advanceTimersByTime(AUTOSAVE_DELAY_MS))
    expect(write).toHaveBeenCalledTimes(1)
    expect(writes[0].doc).toEqual({ v: 'A' })

    act(() => result.current.setDoc({ v: 'B' }))
    await act(async () => writes[0].resolve())
    // A is written; B is not, and must not be reported as saved.
    expect(result.current.isDirty).toBe(true)
    expect(result.current.saveStatus).toBe('saving')

    await act(async () => vi.advanceTimersByTime(AUTOSAVE_DELAY_MS))
    expect(write).toHaveBeenCalledTimes(2)
    expect(writes[1].doc).toEqual({ v: 'B' })
    await act(async () => writes[1].resolve())
    expect(result.current.isDirty).toBe(false)
    expect(result.current.saveStatus).toBe('saved')
  })

  it('writes one version after another, never two at once', async () => {
    const first = deferred()
    const write = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue()
    const { result } = renderHook(() => useHost(write))

    act(() => result.current.setDoc({ v: 'A' }))
    await act(async () => vi.advanceTimersByTime(AUTOSAVE_DELAY_MS))
    act(() => result.current.setDoc({ v: 'B' }))
    await act(async () => vi.advanceTimersByTime(AUTOSAVE_DELAY_MS))
    // B's turn has come, but A has not landed yet: B waits.
    expect(write).toHaveBeenCalledTimes(1)

    await act(async () => first.resolve())
    await settle()
    expect(write).toHaveBeenCalledTimes(2)
    expect(write.mock.calls[1][0]).toEqual({ v: 'B' })
  })

  it('writes the pending change out on flush, without waiting for the debounce', async () => {
    const write = vi.fn().mockResolvedValue()
    const { result } = renderHook(() => useHost(write))
    act(() => result.current.setDoc({ v: 'A' }))
    let ok
    await act(async () => { ok = await result.current.flush() })
    expect(ok).toBe(true)
    expect(write).toHaveBeenCalledWith({ v: 'A' }, 't')
    await act(async () => vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2))
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('reports a failed flush, so the editor can keep the person from leaving', async () => {
    const onError = vi.fn()
    const write = vi.fn().mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useHost(write, onError))
    act(() => result.current.setDoc({ v: 'A' }))
    let ok
    await act(async () => { ok = await result.current.flush() })
    expect(ok).toBe(false)
    expect(onError).toHaveBeenCalled()
    expect(result.current.saveStatus).toBe('error')
    expect(result.current.isDirty).toBe(true)
  })

  it('writes what is pending when the editor goes away', async () => {
    const write = vi.fn().mockResolvedValue()
    const { result, unmount } = renderHook(() => useHost(write))
    act(() => result.current.setDoc({ v: 'A' }))
    unmount()
    await settle()
    expect(write).toHaveBeenCalledWith({ v: 'A' }, 't')
  })

  it('writes nothing when nothing changed', async () => {
    const write = vi.fn().mockResolvedValue()
    const { result, unmount } = renderHook(() => useHost(write))
    await act(async () => { await result.current.flush() })
    unmount()
    await act(async () => vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2))
    expect(write).not.toHaveBeenCalled()
  })
})
