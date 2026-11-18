/* useSettledText: text for work too slow to redo on every key (the sky
   poster's preview), passed on once typing pauses. */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useSettledText, { SETTLE_MS } from '../hooks/useSettledText'

afterEach(() => vi.useRealTimers())

describe('useSettledText', () => {
  it('passes the text on once it has stopped changing', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ text }) => useSettledText(text), { initialProps: { text: 'Leo' } })
    expect(result.current).toBe('Leo')

    rerender({ text: 'Leo i' })
    act(() => vi.advanceTimersByTime(SETTLE_MS - 50))
    rerender({ text: 'Leo is' })
    act(() => vi.advanceTimersByTime(SETTLE_MS - 50))
    expect(result.current).toBe('Leo')

    act(() => vi.advanceTimersByTime(50))
    expect(result.current).toBe('Leo is')
  })

  it('passes the first text of a form that has just loaded on at once', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ text }) => useSettledText(text), { initialProps: { text: undefined } })
    rerender({ text: 'Leo' })
    act(() => vi.advanceTimersByTime(0))
    expect(result.current).toBe('Leo')
  })
})
