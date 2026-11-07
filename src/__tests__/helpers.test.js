import { describe, it, expect, afterEach, vi } from 'vitest'
import i18n from '../i18n'
import { isOnThisDay, exportFileName, formatDate, formatRelativeDate, timeAgo } from '../utils/helpers'

// Fixed reference: April 16 (month index 3, day 16)
const REF = new Date(2026, 3, 16)

describe('isOnThisDay', () => {
  it('returns true for same month and day, different year', () => {
    const date = new Date(2023, 3, 16) // April 16, 2023
    expect(isOnThisDay(date, REF)).toBe(true)
  })

  it('returns true for same month and day, same year', () => {
    const date = new Date(2026, 3, 16)
    expect(isOnThisDay(date, REF)).toBe(true)
  })

  it('returns false for different day, same month', () => {
    const date = new Date(2023, 3, 17) // April 17
    expect(isOnThisDay(date, REF)).toBe(false)
  })

  it('returns false for different month, same day', () => {
    const date = new Date(2023, 4, 16) // May 16
    expect(isOnThisDay(date, REF)).toBe(false)
  })

  it('returns false for completely different date', () => {
    const date = new Date(2022, 0, 1) // Jan 1
    expect(isOnThisDay(date, REF)).toBe(false)
  })

  it('handles Firestore Timestamp objects (with .toDate())', () => {
    const firestoreTs = { toDate: () => new Date(2021, 3, 16) } // April 16, 2021
    expect(isOnThisDay(firestoreTs, REF)).toBe(true)
  })

  it('handles date strings', () => {
    expect(isOnThisDay('2020-04-16', REF)).toBe(true)
    expect(isOnThisDay('2020-04-17', REF)).toBe(false)
  })

  it('uses current date as default reference (smoke test)', () => {
    // Just ensure it doesn't throw
    expect(() => isOnThisDay(new Date())).not.toThrow()
  })
})

describe('exportFileName', () => {
  const AT = new Date(2026, 8, 18, 14, 7) // 18 September 2026, 14:07

  // Scrapbooks all share a default title, so exporting by title alone gave
  // every book the same filename and each download replaced the last.
  it('stamps the name with the moment of export', () => {
    expect(exportFileName('My Scrapbook', 'pdf', { at: AT })).toBe('My Scrapbook-2026-09-18-1407.pdf')
  })

  it('separates two exports of the same book', () => {
    const later = new Date(2026, 8, 18, 14, 8)
    expect(exportFileName('Zell am See', 'pdf', { at: AT }))
      .not.toBe(exportFileName('Zell am See', 'pdf', { at: later }))
  })

  it('drops characters a filesystem will not take', () => {
    expect(exportFileName('Summer 2026: Italy / France', 'pdf', { at: AT }))
      .toBe('Summer 2026 Italy France-2026-09-18-1407.pdf')
  })

  it('falls back when the title is empty or only punctuation', () => {
    expect(exportFileName('', 'pdf', { at: AT, fallback: 'Scrapbook' })).toBe('Scrapbook-2026-09-18-1407.pdf')
    expect(exportFileName('...', 'pdf', { at: AT, fallback: 'Scrapbook' })).toBe('Scrapbook-2026-09-18-1407.pdf')
  })

  it('keeps a long title to a sane length', () => {
    expect(exportFileName('A'.repeat(200), 'pdf', { at: AT })).toBe(`${'A'.repeat(60)}-2026-09-18-1407.pdf`)
  })
})

describe('relative dates', () => {
  const NOW = new Date(2026, 2, 10, 9, 0) // 10 March 2026, 09:00 local
  const at = (...args) => new Date(...args)

  const useLanguage = async (lng) => {
    await i18n.changeLanguage(lng)
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  }

  afterEach(async () => {
    vi.useRealTimers()
    await i18n.changeLanguage('en')
  })

  it('formats dates in the UI language', async () => {
    await useLanguage('en')
    expect(formatDate(at(2026, 2, 7))).toBe('March 7, 2026')
    await i18n.changeLanguage('de')
    expect(formatDate(at(2026, 2, 7))).toBe('7. März 2026')
  })

  it('names today, yesterday and recent days in English', async () => {
    await useLanguage('en')
    expect(formatRelativeDate(at(2026, 2, 10, 0, 5))).toBe('Today')
    expect(formatRelativeDate(at(2026, 2, 9, 23, 0))).toBe('Yesterday')
    expect(formatRelativeDate(at(2026, 2, 7, 12))).toBe('3 days ago')
  })

  it('names today, yesterday and recent days in German', async () => {
    await useLanguage('de')
    expect(formatRelativeDate(at(2026, 2, 10, 0, 5))).toBe('Heute')
    expect(formatRelativeDate(at(2026, 2, 9, 23, 0))).toBe('Gestern')
    expect(formatRelativeDate(at(2026, 2, 7, 12))).toBe('Vor 3 Tagen')
  })

  it('counts calendar days, not 24h windows', async () => {
    await useLanguage('en')
    // 10 hours ago, but on the previous calendar day.
    vi.setSystemTime(at(2026, 2, 10, 7, 0))
    expect(formatRelativeDate(at(2026, 2, 9, 21, 0))).toBe('Yesterday')
    // 23 hours ago on the same calendar day is impossible; 1 minute ago is today.
    expect(formatRelativeDate(at(2026, 2, 10, 6, 59))).toBe('Today')
  })

  it('falls back to the plain date after a week', async () => {
    await useLanguage('en')
    expect(formatRelativeDate(at(2026, 1, 20))).toBe('February 20, 2026')
  })

  it('does not call a future date "ago"', async () => {
    await useLanguage('en')
    expect(formatRelativeDate(at(2026, 2, 13))).toBe('March 13, 2026')
    expect(timeAgo(at(2026, 2, 13))).toBe('March 13, 2026')
  })

  it('handles Firestore Timestamps and empty values', async () => {
    await useLanguage('en')
    expect(formatRelativeDate({ toDate: () => at(2026, 2, 10, 1) })).toBe('Today')
    expect(formatRelativeDate(null)).toBe('')
    expect(timeAgo(undefined)).toBe('')
  })

  it('timeAgo reads minutes and hours in both languages', async () => {
    await useLanguage('en')
    expect(timeAgo(at(2026, 2, 10, 8, 59, 40))).toBe('Now')
    expect(timeAgo(at(2026, 2, 10, 8, 45))).toBe('15 minutes ago')
    expect(timeAgo(at(2026, 2, 10, 6, 0))).toBe('3 hours ago')
    expect(timeAgo(at(2026, 2, 9, 8, 0))).toBe('Yesterday')
    expect(timeAgo(at(2026, 2, 5, 12, 0))).toBe('March 5, 2026')
    await i18n.changeLanguage('de')
    expect(timeAgo(at(2026, 2, 10, 8, 45))).toBe('Vor 15 Minuten')
    expect(timeAgo(at(2026, 2, 10, 6, 0))).toBe('Vor 3 Stunden')
    expect(timeAgo(at(2026, 2, 9, 8, 0))).toBe('Gestern')
  })
})
