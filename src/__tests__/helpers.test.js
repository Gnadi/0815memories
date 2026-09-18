import { describe, it, expect } from 'vitest'
import { isOnThisDay, exportFileName } from '../utils/helpers'

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
