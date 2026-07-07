import { describe, it, expect } from 'vitest'
import { LOGIN_STARTER_TEMPLATES } from '../utils/loginPageTemplates'
import {
  sanitizeLoginHtml,
  sanitizeLoginCss,
  MAX_LOGIN_HTML_LENGTH,
  MAX_LOGIN_CSS_LENGTH,
} from '../utils/loginPageSanitizer'

describe('LOGIN_STARTER_TEMPLATES', () => {
  it('has unique keys and complete entries', () => {
    expect(LOGIN_STARTER_TEMPLATES.length).toBeGreaterThan(1)
    const keys = LOGIN_STARTER_TEMPLATES.map((tpl) => tpl.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const tpl of LOGIN_STARTER_TEMPLATES) {
      expect(tpl.key).toBeTruthy()
      expect(tpl.swatch).toBeTruthy()
      expect(tpl.html.trim()).toBeTruthy()
      expect(tpl.css.trim()).toBeTruthy()
    }
  })

  describe.each(LOGIN_STARTER_TEMPLATES)('template "$key"', (tpl) => {
    it('fits within the stored-length limits', () => {
      expect(tpl.html.length).toBeLessThanOrEqual(MAX_LOGIN_HTML_LENGTH)
      expect(tpl.css.length).toBeLessThanOrEqual(MAX_LOGIN_CSS_LENGTH)
    })

    it('styles the shadow-root .canvas hook', () => {
      expect(tpl.css).toContain('.canvas {')
    })

    it('passes the CSS sanitizer unchanged', () => {
      expect(sanitizeLoginCss(tpl.css)).toBe(tpl.css)
    })

    it('keeps its heading and structure through the HTML sanitizer', () => {
      const out = sanitizeLoginHtml(tpl.html)
      const heading = tpl.html.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1].trim()
      expect(heading).toBeTruthy()
      expect(out).toContain(heading)
      expect(out).toContain('class="page"')
    })
  })
})
