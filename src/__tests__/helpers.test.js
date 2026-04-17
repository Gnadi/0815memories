import { describe, it, expect } from 'vitest'
import { isOnThisDay } from '../utils/helpers'

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
