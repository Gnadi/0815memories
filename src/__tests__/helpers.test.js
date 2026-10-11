import { describe, it, expect } from 'vitest'
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

// These used to format in 'en-US' and say "Yesterday" whatever the language.
describe('date formatting in the reader\'s language', () => {
  const NOW = new Date(2026, 9, 10, 8, 0) // 10 October 2026, 08:00
  const minutesAgo = (n) => new Date(NOW.getTime() - n * 60000)

  it('writes the date the way each language does', () => {
    const date = new Date(2026, 0, 5)
    expect(formatDate(date, 'en')).toBe('January 5, 2026')
    expect(formatDate(date, 'de')).toBe('5. Januar 2026')
    expect(formatDate({ toDate: () => date }, 'de')).toBe('5. Januar 2026')
    expect(formatDate(null, 'de')).toBe('')
  })

  it('counts calendar days for today, yesterday and the rest of the week', () => {
    expect(formatRelativeDate(minutesAgo(30), 'en', { now: NOW })).toBe('Today')
    expect(formatRelativeDate(minutesAgo(30), 'de', { now: NOW })).toBe('Heute')
    // 23:00 last night is yesterday, though not 24 hours ago.
    const lastNight = new Date(2026, 9, 9, 23, 0)
    expect(formatRelativeDate(lastNight, 'en', { now: NOW })).toBe('Yesterday')
    expect(formatRelativeDate(lastNight, 'de', { now: NOW })).toBe('Gestern')
    expect(formatRelativeDate(new Date(2026, 9, 7, 12, 0), 'en', { now: NOW })).toBe('3 days ago')
    expect(formatRelativeDate(new Date(2026, 9, 7, 12, 0), 'de', { now: NOW })).toBe('Vor 3 Tagen')
    expect(formatRelativeDate(new Date(2026, 8, 30), 'de', { now: NOW })).toBe('30. September 2026')
  })

  it('says how long ago something was posted', () => {
    expect(timeAgo(minutesAgo(0), 'de', { now: NOW, justNow: 'Gerade eben' })).toBe('Gerade eben')
    expect(timeAgo(minutesAgo(5), 'en', { now: NOW })).toBe('5 minutes ago')
    expect(timeAgo(minutesAgo(5), 'de', { now: NOW })).toBe('Vor 5 Minuten')
    expect(timeAgo(minutesAgo(180), 'de', { now: NOW })).toBe('Vor 3 Stunden')
    expect(timeAgo(minutesAgo(26 * 60), 'en', { now: NOW })).toBe('Yesterday')
    expect(timeAgo(minutesAgo(26 * 60), 'de', { now: NOW })).toBe('Gestern')
    expect(timeAgo(new Date(2026, 9, 1), 'de', { now: NOW })).toBe('1. Oktober 2026')
  })
})
