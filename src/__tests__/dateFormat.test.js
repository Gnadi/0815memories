/* utils/dateFormat.js: dates as toLocaleDateString writes them, from a
   formatter kept per language and options instead of one built per call. */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatDateIn, relativeTimeFormat } from '../utils/dateFormat'

afterEach(() => vi.restoreAllMocks())

describe('formatDateIn', () => {
  const date = new Date(2024, 9, 18)

  it('writes what toLocaleDateString writes', () => {
    for (const [locale, options] of [
      ['de', { day: 'numeric', month: 'long', year: 'numeric' }],
      ['en', { month: 'short' }],
      ['en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }],
    ]) {
      expect(formatDateIn(date, locale, options)).toBe(date.toLocaleDateString(locale, options))
    }
  })

  it('builds one formatter per language and options', () => {
    const made = vi.spyOn(Intl, 'DateTimeFormat')
    for (let i = 0; i < 50; i++) formatDateIn(date, 'fr', { month: 'long', day: 'numeric' })
    formatDateIn(date, 'fr', { month: 'short' })
    expect(made).toHaveBeenCalledTimes(2)
  })
})

describe('relativeTimeFormat', () => {
  it('keeps one formatter per language and options', () => {
    expect(relativeTimeFormat('de', { numeric: 'auto' })).toBe(relativeTimeFormat('de', { numeric: 'auto' }))
    expect(relativeTimeFormat('de', { numeric: 'auto' }).format(-1, 'day')).toBe('gestern')
  })
})
