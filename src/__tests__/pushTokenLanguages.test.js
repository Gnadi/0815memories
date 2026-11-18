// @vitest-environment node
/**
 * A device registers for push in its interface language, and firestore.rules
 * accepts only the languages it lists. When a language was added to the app
 * without that list, French and Arabic devices could not register at all, so
 * the two lists are kept equal here.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SUPPORTED_LANGUAGES } from '../i18n'

const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8')

describe('push token languages', () => {
  it('lets every language of the app register a device', () => {
    const match = rules.match(/d\.get\('lang', 'de'\) in \[([^\]]*)\]/)
    expect(match).not.toBeNull()
    const allowed = [...match[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1])
    expect([...allowed].sort()).toEqual([...SUPPORTED_LANGUAGES].sort())
  })
})
