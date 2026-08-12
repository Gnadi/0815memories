import { describe, it, expect } from 'vitest'
import { buildPushMessage, normalizeLang, PUSH_KINDS } from '../utils/pushMessages.js'

describe('normalizeLang', () => {
  it('accepts the two supported languages', () => {
    expect(normalizeLang('de')).toBe('de')
    expect(normalizeLang('en')).toBe('en')
  })

  it('reduces regional variants to their base language', () => {
    expect(normalizeLang('en-GB')).toBe('en')
    expect(normalizeLang('de-AT')).toBe('de')
  })

  it('falls back to German for anything unknown or missing', () => {
    expect(normalizeLang('fr')).toBe('de')
    expect(normalizeLang(undefined)).toBe('de')
    expect(normalizeLang(null)).toBe('de')
    expect(normalizeLang('')).toBe('de')
  })
})

describe('buildPushMessage', () => {
  it('returns a complete payload for every kind in both languages', () => {
    for (const kind of PUSH_KINDS) {
      for (const lang of ['de', 'en']) {
        const msg = buildPushMessage(kind, lang, { memoryId: 'abc123', count: 2, year: 2023 })
        expect(msg, `${kind}/${lang}`).toBeTruthy()
        expect(msg.title.length, `${kind}/${lang} title`).toBeGreaterThan(0)
        expect(msg.body.length, `${kind}/${lang} body`).toBeGreaterThan(0)
        expect(msg.url.startsWith('/'), `${kind}/${lang} url`).toBe(true)
      }
    }
  })

  it('returns null for an unknown kind so the endpoint can reject it', () => {
    expect(buildPushMessage('nope', 'de')).toBeNull()
    expect(buildPushMessage(undefined, 'de')).toBeNull()
  })

  it('links a memory notification to that memory', () => {
    expect(buildPushMessage('memory', 'de', { memoryId: 'abc123' }).url).toBe('/memory/abc123')
  })

  it('falls back to the timeline when no memory id was given', () => {
    expect(buildPushMessage('memory', 'de').url).toBe('/timeline')
  })

  it('sends moments to the feed and anniversaries to the on-this-day filter', () => {
    expect(buildPushMessage('moment', 'de').url).toBe('/')
    expect(buildPushMessage('anniversary', 'de', { count: 1, year: 2023 }).url).toBe(
      '/timeline?filter=onthisday'
    )
  })

  it('uses singular and plural anniversary wording correctly', () => {
    const de1 = buildPushMessage('anniversary', 'de', { count: 1, year: 2023 })
    expect(de1.body).toContain('1 Erinnerung')
    expect(de1.body).not.toContain('Erinnerungen')
    expect(buildPushMessage('anniversary', 'de', { count: 4, year: 2023 }).body).toContain(
      '4 Erinnerungen'
    )

    const en1 = buildPushMessage('anniversary', 'en', { count: 1, year: 2023 })
    expect(en1.body).toContain('1 memory')
    expect(en1.body).not.toContain('memories')
    expect(buildPushMessage('anniversary', 'en', { count: 4, year: 2023 }).body).toContain(
      '4 memories'
    )
  })

  it('keeps the established German anniversary wording', () => {
    const msg = buildPushMessage('anniversary', 'de', { count: 2, year: 2023 })
    expect(msg.title).toContain('3 Jahre')
    expect(msg.body).toContain('2023')
  })

  it('leaks no user content: nothing but a document id can reach a payload', () => {
    // The whole point of building text server-side. If someone ever adds an
    // interpolated title here, this fails.
    const msg = buildPushMessage('memory', 'de', {
      memoryId: 'abc123',
      title: 'Sommerurlaub 2024',
      caption: 'Am Strand',
    })
    expect(msg.title).not.toContain('Sommerurlaub')
    expect(msg.body).not.toContain('Sommerurlaub')
    expect(msg.body).not.toContain('Strand')
  })
})
