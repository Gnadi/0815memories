import { describe, it, expect } from 'vitest'
import { normalizeLoginCard, CARD_STYLES, LOGIN_CARD_STYLES } from '../utils/loginCard'

describe('normalizeLoginCard', () => {
  it('defaults to minimized + light', () => {
    expect(normalizeLoginCard(undefined)).toEqual({ behavior: 'minimized', style: 'light' })
    expect(normalizeLoginCard(null)).toEqual({ behavior: 'minimized', style: 'light' })
    expect(normalizeLoginCard({})).toEqual({ behavior: 'minimized', style: 'light' })
  })

  it('accepts valid values', () => {
    expect(normalizeLoginCard({ behavior: 'card', style: 'dark' }))
      .toEqual({ behavior: 'card', style: 'dark' })
    expect(normalizeLoginCard({ behavior: 'minimized', style: 'glass' }))
      .toEqual({ behavior: 'minimized', style: 'glass' })
  })

  it('falls back on unknown or malformed values', () => {
    expect(normalizeLoginCard({ behavior: 'hidden', style: 'neon' }))
      .toEqual({ behavior: 'minimized', style: 'light' })
    expect(normalizeLoginCard('nope')).toEqual({ behavior: 'minimized', style: 'light' })
    expect(normalizeLoginCard(42)).toEqual({ behavior: 'minimized', style: 'light' })
    expect(normalizeLoginCard({ behavior: 7, style: [] }))
      .toEqual({ behavior: 'minimized', style: 'light' })
  })

  it('every style enum value has a preset definition', () => {
    for (const key of LOGIN_CARD_STYLES) {
      expect(CARD_STYLES[key]).toBeDefined()
      expect(CARD_STYLES[key].cardClass).toBeTruthy()
      expect(['light', 'dark']).toContain(CARD_STYLES[key].tone)
    }
  })
})
