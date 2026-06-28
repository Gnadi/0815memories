import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n, { resources, NAMESPACES, SUPPORTED_LANGUAGES } from '../i18n'
import LanguageSwitcher from '../components/LanguageSwitcher'

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
