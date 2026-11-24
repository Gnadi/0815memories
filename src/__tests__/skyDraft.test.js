/**
 * A birth sky made on the public page, kept in the browser while its maker
 * signs up — utils/sky/skyDraft.js.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  DRAFT_STYLES,
  DRAFT_VALID_DAYS,
  SKY_DRAFT_KEY,
  clearSkyDraft,
  loadSkyDraft,
  readDraft,
  saveSkyDraft,
} from '../utils/sky/skyDraft'
import { SKY_STYLES } from '../utils/sky/skyRenderer'

const NOW = Date.parse('2026-11-24T12:00:00Z')
const LINZ = { name: 'Linz', country: 'AT', lat: 48.31, lon: 14.29, tz: 'Europe/Vienna' }
const draft = (overrides = {}) => ({
  name: 'Leo',
  birthDate: '2026-11-20',
  birthTime: '04:17',
  birthPlace: LINZ,
  skyStyle: 'kaydo',
  title: 'Leo',
  dedication: 'Willkommen',
  order: true,
  ...overrides,
})

beforeEach(() => localStorage.clear())

describe('sky draft', () => {
  it('keeps the poster until it is taken over', () => {
    expect(saveSkyDraft(draft(), NOW)).toBe(true)
    expect(loadSkyDraft(NOW + 1000)).toEqual({ ...draft(), savedAt: NOW })
    clearSkyDraft()
    expect(loadSkyDraft(NOW)).toBeNull()
  })

  it('forgets a draft after a week, and removes it', () => {
    saveSkyDraft(draft(), NOW)
    expect(loadSkyDraft(NOW + (DRAFT_VALID_DAYS + 1) * 86400000)).toBeNull()
    expect(localStorage.getItem(SKY_DRAFT_KEY)).toBeNull()
  })

  it('needs a name, a date and a place', () => {
    expect(saveSkyDraft(draft({ name: '  ' }), NOW)).toBe(false)
    expect(saveSkyDraft(draft({ birthDate: '20.11.2026' }), NOW)).toBe(false)
    expect(saveSkyDraft(draft({ birthPlace: null }), NOW)).toBe(false)
    expect(localStorage.getItem(SKY_DRAFT_KEY)).toBeNull()
  })

  it('reads what was stored as data, not as given', () => {
    const read = readDraft(
      { ...draft({ birthTime: 'soon', skyStyle: 'neon', order: 'yes', title: 'x'.repeat(99) }), savedAt: NOW },
      NOW,
    )
    expect(read).toMatchObject({ birthTime: '', skyStyle: 'midnight', order: false })
    expect(read.title).toHaveLength(40)
    expect(readDraft({ ...draft({ birthPlace: { ...LINZ, lat: 123 } }), savedAt: NOW }, NOW)).toBeNull()
    localStorage.setItem(SKY_DRAFT_KEY, '{not json')
    expect(loadSkyDraft(NOW)).toBeNull()
  })

  it('knows the renderer’s styles', () => {
    expect(DRAFT_STYLES).toEqual(Object.keys(SKY_STYLES))
  })
})
