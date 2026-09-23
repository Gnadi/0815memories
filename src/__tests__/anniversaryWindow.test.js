/**
 * Tests for functions/anniversary.js — the date maths behind the daily
 * "three years ago today" push.
 *
 * It moved out of the browser (src/utils/anniversaryClient.js, which ran only
 * when an admin happened to open the app) and into a scheduled Cloud Function
 * that runs in UTC. That is the whole reason this file exists: "the same
 * calendar day three years ago" is a statement about a timezone, and the one
 * the scheduler runs in is not the one the family lives in.
 *
 * The module deliberately imports no firebase-admin, so it runs here as-is.
 */
import { describe, it, expect } from 'vitest'
import { anniversaryWindow, zoneOffsetMs } from '../../functions/anniversary.js'

const TZ = 'Europe/Berlin'

describe('zoneOffsetMs', () => {
  it('reports +1h in winter and +2h in summer', () => {
    expect(zoneOffsetMs(Date.UTC(2026, 0, 15, 12), TZ)).toBe(3600000)
    expect(zoneOffsetMs(Date.UTC(2026, 6, 15, 12), TZ)).toBe(7200000)
  })

  it('is exact to the millisecond', () => {
    // formatToParts has no millisecond field. Carrying the input's own
    // milliseconds across is what keeps the day boundary from landing a second
    // into the next day.
    expect(zoneOffsetMs(Date.UTC(2026, 6, 15, 12, 0, 0, 999), TZ)).toBe(7200000)
  })
})

describe('anniversaryWindow', () => {
  it('spans exactly the target day in the family timezone', () => {
    // 08:00 Berlin on 18 Sep 2026 — when the schedule fires.
    const { start, end, year } = anniversaryWindow(new Date('2026-09-18T06:00:00Z'), TZ)
    expect(year).toBe(2023)
    // Summer time: midnight Berlin is 22:00 UTC the day before.
    expect(start.toISOString()).toBe('2023-09-17T22:00:00.000Z')
    expect(end.toISOString()).toBe('2023-09-18T21:59:59.999Z')
    expect(end - start).toBe(24 * 60 * 60 * 1000 - 1)
  })

  it('shifts with winter time', () => {
    const { start, end } = anniversaryWindow(new Date('2026-01-15T07:00:00Z'), TZ)
    expect(start.toISOString()).toBe('2023-01-14T23:00:00.000Z')
    expect(end.toISOString()).toBe('2023-01-15T22:59:59.999Z')
  })

  it('takes the calendar day from the timezone, not from UTC', () => {
    // 00:30 Berlin on 1 March — still 28 February in UTC. The window has to
    // follow the family's date, or the reminder lands a day late.
    const { start } = anniversaryWindow(new Date('2026-02-28T23:30:00Z'), TZ)
    expect(start.toISOString()).toBe('2023-02-28T23:00:00.000Z')
  })

  it('still produces a 24-hour window on a DST changeover day', () => {
    // 29 March 2026 is a spring-forward day in Berlin; the target day, 29 March
    // 2023, is not — so the window is a plain 24 hours of the target day.
    const { start, end } = anniversaryWindow(new Date('2026-03-29T06:00:00Z'), TZ)
    expect(start.toISOString()).toBe('2023-03-28T22:00:00.000Z')
    expect(end.toISOString()).toBe('2023-03-29T21:59:59.999Z')
  })

  it('covers the short day when the target day is the one that springs forward', () => {
    // 26 March 2023 lost an hour in Berlin: 02:00 never happened. The window is
    // 23 hours long, and that is correct — nothing can be dated inside the gap.
    const { start, end } = anniversaryWindow(new Date('2026-03-26T06:00:00Z'), TZ)
    expect(start.toISOString()).toBe('2023-03-25T23:00:00.000Z')
    expect(end.toISOString()).toBe('2023-03-26T21:59:59.999Z')
    expect(end - start).toBe(23 * 60 * 60 * 1000 - 1)
  })
})
