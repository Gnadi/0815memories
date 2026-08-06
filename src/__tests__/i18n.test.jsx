import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n, { NAMESPACES, EAGER_NAMESPACES, LAZY_NAMESPACES, SUPPORTED_LANGUAGES } from '../i18n'
import LanguageSwitcher from '../components/LanguageSwitcher'

// Read the locale files straight from disk rather than through the i18n module:
// only the eager namespaces are bundled there, the rest is code-split behind
// ensureAppTranslations(). Completeness has to be checked over all of them.
const localeModules = import.meta.glob('../locales/*/*.json', { eager: true })
const resources = {}
for (const [path, mod] of Object.entries(localeModules)) {
  const [, lng, file] = path.match(/\/locales\/([^/]+)\/([^/]+)\.json$/)
  resources[lng] ??= {}
  resources[lng][file] = mod.default
}

// Recursively collect leaf key paths from a nested translation object.
// Arrays are treated as leaves (their position/shape is what matters).
function leafKeys(obj, prefix = '') {
  let out = []
  for (const k of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    const v = obj[k]
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out = out.concat(leafKeys(v, path))
    } else {
      out.push(path)
    }
  }
  return out
}

describe('i18n translation completeness', () => {
  it('every namespace has matching key sets across all languages', () => {
    for (const ns of NAMESPACES) {
      const reference = new Set(leafKeys(resources.en[ns]))
      for (const lng of SUPPORTED_LANGUAGES) {
        if (lng === 'en') continue
        const keys = new Set(leafKeys(resources[lng][ns]))
        const missing = [...reference].filter((k) => !keys.has(k))
        const extra = [...keys].filter((k) => !reference.has(k))
        expect(missing, `${lng}/${ns} missing keys vs en`).toEqual([])
        expect(extra, `${lng}/${ns} extra keys not in en`).toEqual([])
      }
    }
  })

  it('German is available for the expected namespaces', () => {
    expect(SUPPORTED_LANGUAGES).toContain('de')
    expect(resources.de.common.language.de).toBe('Deutsch')
  })

  it('every namespace on disk is registered as either eager or lazy', () => {
    const onDisk = Object.keys(resources.en).sort()
    expect([...NAMESPACES].sort()).toEqual(onDisk)
    // A namespace in both lists would be shipped twice; in neither, never at all.
    expect(EAGER_NAMESPACES.filter((ns) => LAZY_NAMESPACES.includes(ns))).toEqual([])
  })

  it('keeps the public shell namespaces in the startup bundle', () => {
    // The pre-rendered landing page and the login form must have real strings
    // on their first synchronous render — they cannot wait for a chunk.
    expect(EAGER_NAMESPACES).toEqual(['common', 'landing', 'auth'])
    expect(i18n.getResourceBundle('en', 'landing')).toBeTruthy()
    expect(i18n.getResourceBundle('en', 'auth')).toBeTruthy()
  })
})

describe('LanguageSwitcher', () => {
  afterEach(() => {
    i18n.changeLanguage('en')
    localStorage.clear()
  })

  it('switches the active language and persists the choice', () => {
    render(<LanguageSwitcher variant="sidebar" />)
    // Both language options are rendered as buttons.
    const german = screen.getByRole('button', { name: 'Deutsch' })
    fireEvent.click(german)
    expect(i18n.language.split('-')[0]).toBe('de')
    expect(localStorage.getItem('kaydo_lang')).toBe('de')
  })
})
