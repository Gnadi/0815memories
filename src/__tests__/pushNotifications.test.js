/**
 * Tests for functions/push.js — the two decisions that determine whether a
 * family keeps receiving notifications at all.
 *
 * Both replace behaviour that was wrong in the previous dispatcher:
 *
 *   1. It deleted a token document on *any* rejected send, so a transient FCM
 *      error unsubscribed a healthy device for good.
 *   2. It sent one hard-coded English string, composed by the client, carrying
 *      the plaintext title of an encrypted memory.
 *
 * The module imports no firebase-admin, so it runs in this suite as-is.
 */
import { describe, it, expect } from 'vitest'
import {
  COPY,
  anniversaryCopy,
  chunk,
  groupTokensByLang,
  isDeadToken,
  normalizeLang,
} from '../../functions/push.js'

/** Stands in for a Firestore QueryDocumentSnapshot. */
const tokenDoc = (data) => ({ data: () => data })

describe('isDeadToken', () => {
  it('deletes a token FCM says is unregistered', () => {
    expect(isDeadToken('messaging/registration-token-not-registered')).toBe(true)
    expect(isDeadToken('messaging/invalid-registration-token')).toBe(true)
  })

  it('keeps the token when FCM is merely having a bad minute', () => {
    // The whole point: these used to delete the document too.
    expect(isDeadToken('messaging/server-unavailable')).toBe(false)
    expect(isDeadToken('messaging/internal-error')).toBe(false)
    expect(isDeadToken('messaging/quota-exceeded')).toBe(false)
    expect(isDeadToken(undefined)).toBe(false)
  })
})

describe('normalizeLang', () => {
  it('maps regional English variants onto en', () => {
    expect(normalizeLang('en-GB')).toBe('en')
    expect(normalizeLang('EN')).toBe('en')
  })

  it('falls back to German for anything else', () => {
    expect(normalizeLang('de-AT')).toBe('de')
    expect(normalizeLang('fr')).toBe('de')
    expect(normalizeLang(undefined)).toBe('de')
  })
})

describe('groupTokensByLang', () => {
  it('splits devices by the language they read', () => {
    const groups = groupTokensByLang([
      tokenDoc({ token: 'a', lang: 'de' }),
      tokenDoc({ token: 'b', lang: 'en-US' }),
      tokenDoc({ token: 'c' }),
    ])
    expect([...groups.keys()].sort()).toEqual(['de', 'en'])
    expect(groups.get('de')).toHaveLength(2)
    expect(groups.get('en')).toHaveLength(1)
  })

  it('leaves the author of the memory alone', () => {
    const groups = groupTokensByLang(
      [
        tokenDoc({ token: 'author', lang: 'de', uid: 'uid-1' }),
        tokenDoc({ token: 'other', lang: 'de', uid: 'uid-2' }),
      ],
      { excludeUid: 'uid-1' },
    )
    expect(groups.get('de').map((d) => d.data().token)).toEqual(['other'])
  })

  it('never excludes on a null uid', () => {
    // Documents written before `uid` existed have none; they must still be
    // notified rather than matched against an absent author.
    const groups = groupTokensByLang(
      [tokenDoc({ token: 'legacy', lang: 'de', uid: null })],
      { excludeUid: null },
    )
    expect(groups.get('de')).toHaveLength(1)
  })

  it('skips documents with no token', () => {
    expect(groupTokensByLang([tokenDoc({ lang: 'de' })]).size).toBe(0)
  })
})

describe('the notification copy', () => {
  it('exists in both languages for every kind', () => {
    for (const kind of Object.keys(COPY)) {
      for (const lang of ['de', 'en']) {
        expect(COPY[kind][lang].title).toBeTruthy()
        expect(COPY[kind][lang].body).toBeTruthy()
      }
    }
  })

  it('never names the memory it is about', () => {
    // Titles and captions are encrypted. A push carrying one would put it on a
    // lock screen and in Google's hands, which is the one thing the
    // client-composed version did.
    const text = JSON.stringify(COPY)
    expect(text).not.toMatch(/\{\{|\$\{/)
  })

  it('counts memories in the reader\'s language, singular and plural', () => {
    expect(anniversaryCopy('de', 1, 2023).body).toContain('1 Erinnerung')
    expect(anniversaryCopy('de', 1, 2023).body).not.toContain('Erinnerungen')
    expect(anniversaryCopy('de', 4, 2023).body).toContain('4 Erinnerungen')
    expect(anniversaryCopy('en', 1, 2023).body).toContain('1 memory')
    expect(anniversaryCopy('en', 4, 2023).body).toContain('4 memories')
    expect(anniversaryCopy('de', 2, 2023).title).toContain('3 Jahre')
  })
})

describe('chunk', () => {
  it('splits into batches of at most the given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('returns nothing for an empty list', () => {
    expect(chunk([], 500)).toEqual([])
  })
})
