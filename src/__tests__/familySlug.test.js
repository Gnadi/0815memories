import { describe, it, expect, afterEach, vi } from 'vitest'
import { generateSlug, getSubdomainSlug } from '../utils/familySlug'

// familySlug pulls `db` from ../config/firebase, which eagerly tries to call
// initializeApp. The pure helpers exercised here don't touch Firestore, but we
// still need to mock the module to stop import-time side effects.
vi.mock('../config/firebase', () => ({ db: null }))

describe('generateSlug', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(generateSlug('The Millers')).toBe('the-millers')
  })

  it('strips non alphanumeric characters', () => {
    expect(generateSlug("O'Brien & Co.")).toBe('obrien-co')
  })

  it('collapses repeated spaces and hyphens', () => {
    expect(generateSlug('A   B --- C')).toBe('a-b-c')
  })

  it('trims leading and trailing hyphens', () => {
    expect(generateSlug('  --hello--  ')).toBe('hello')
  })

  it('returns empty string when nothing survives normalization', () => {
    expect(generateSlug('!!!')).toBe('')
  })

  it('preserves digits', () => {
    expect(generateSlug('Family 2024')).toBe('family-2024')
  })
})

describe('getSubdomainSlug', () => {
  const originalLocation = window.location

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true })
  })

  function setHostname(hostname) {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, hostname },
      configurable: true,
    })
  }

  it('returns null on localhost', () => {
    setHostname('localhost')
    expect(getSubdomainSlug()).toBe(null)
  })

  it('returns null on IP addresses', () => {
    setHostname('192.168.1.1')
    expect(getSubdomainSlug()).toBe(null)
  })

  it('returns null on bare domains (no subdomain)', () => {
    setHostname('familyheart.com')
    expect(getSubdomainSlug()).toBe(null)
  })

  it('returns null on vercel.app preview URLs', () => {
    setHostname('kaydo-abc123.vercel.app')
    expect(getSubdomainSlug()).toBe(null)
  })

  it('returns null when the subdomain is "www"', () => {
    setHostname('www.familyheart.com')
    expect(getSubdomainSlug()).toBe(null)
  })

  it('extracts the subdomain from a standard three-part hostname', () => {
    setHostname('the-millers.familyheart.com')
    expect(getSubdomainSlug()).toBe('the-millers')
  })

  it('keeps multi-segment subdomains intact', () => {
    setHostname('beta.the-millers.familyheart.com')
    expect(getSubdomainSlug()).toBe('beta.the-millers')
  })
})
