import { describe, it, expect } from 'vitest'
import {
  sanitizeLoginHtml,
  sanitizeLoginCss,
  MAX_LOGIN_HTML_LENGTH,
  MAX_LOGIN_CSS_LENGTH,
} from '../utils/loginPageSanitizer'

describe('sanitizeLoginHtml', () => {
  it('strips script tags', () => {
    const out = sanitizeLoginHtml('<div>hi</div><script>alert(1)</script>')
    expect(out).toContain('hi')
    expect(out).not.toContain('script')
    expect(out).not.toContain('alert')
  })

  it('strips inline event handlers', () => {
    const out = sanitizeLoginHtml('<img src="x" onerror="alert(1)"><p onclick="alert(2)">hi</p>')
    expect(out).not.toContain('onerror')
    expect(out).not.toContain('onclick')
  })

  it('strips javascript: URLs', () => {
    const out = sanitizeLoginHtml('<a href="javascript:alert(1)">click</a>')
    expect(out).not.toContain('javascript:')
  })

  it('strips embedded browsing contexts', () => {
    const out = sanitizeLoginHtml(
      '<iframe src="https://evil.example"></iframe><object data="x"></object><embed src="x">'
    )
    expect(out).not.toContain('iframe')
    expect(out).not.toContain('object')
    expect(out).not.toContain('embed')
  })

  it('removes form elements so custom content cannot spoof the password field', () => {
    const out = sanitizeLoginHtml(
      '<form action="https://evil.example"><label>Password</label><input type="password"><button>Login</button></form><textarea></textarea><select></select>'
    )
    expect(out).not.toContain('<form')
    expect(out).not.toContain('<input')
    expect(out).not.toContain('<button')
    expect(out).not.toContain('<textarea')
    expect(out).not.toContain('<select')
    expect(out).not.toContain('<label')
  })

  it('removes style tags (CSS lives in its own sanitized field)', () => {
    const out = sanitizeLoginHtml('<style>.x{color:red}</style><p>hi</p>')
    expect(out).not.toContain('style>')
    expect(out).toContain('hi')
  })

  it('removes focus- and edit-hijacking attributes', () => {
    const out = sanitizeLoginHtml('<div contenteditable tabindex="1" autofocus>hi</div>')
    expect(out).not.toContain('contenteditable')
    expect(out).not.toContain('tabindex')
    expect(out).not.toContain('autofocus')
  })

  it('keeps the MySpace essentials: marquee, images, inline styles', () => {
    const out = sanitizeLoginHtml(
      '<marquee behavior="scroll" scrollamount="6">hi</marquee>' +
      '<img src="https://res.cloudinary.com/x/img.jpg" width="200">' +
      '<p style="color: hotpink">glam</p>'
    )
    expect(out).toContain('<marquee')
    expect(out).toContain('scrollamount="6"')
    expect(out).toContain('img')
    expect(out).toContain('res.cloudinary.com')
    expect(out).toContain('style=')
    expect(out).toContain('hotpink')
  })

  it('rewrites links to open safely in a new tab', () => {
    const out = sanitizeLoginHtml('<a href="https://example.com">site</a>')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it('truncates oversized input', () => {
    const big = '<p>' + 'a'.repeat(MAX_LOGIN_HTML_LENGTH * 2) + '</p>'
    const out = sanitizeLoginHtml(big)
    // Truncation happens on the input; the sanitizer may append a few chars
    // closing dangling tags afterwards.
    expect(out.length).toBeLessThanOrEqual(MAX_LOGIN_HTML_LENGTH + 16)
  })

  it('handles empty and non-string input', () => {
    expect(sanitizeLoginHtml('')).toBe('')
    expect(sanitizeLoginHtml(null)).toBe('')
    expect(sanitizeLoginHtml(undefined)).toBe('')
    expect(sanitizeLoginHtml(42)).toBe('')
  })
})

describe('sanitizeLoginCss', () => {
  it('strips @import rules', () => {
    const out = sanitizeLoginCss('@import url("https://evil.example/x.css"); .a{color:red}')
    expect(out).not.toContain('@import')
    expect(out).toContain('.a{color:red}')
  })

  it('neutralizes expression() and javascript:', () => {
    const out = sanitizeLoginCss('.a{width:expression(alert(1));background:url(javascript:alert(2))}')
    expect(out).not.toContain('expression(')
    expect(out).not.toContain('javascript:')
  })

  it('truncates oversized input', () => {
    const out = sanitizeLoginCss('a'.repeat(MAX_LOGIN_CSS_LENGTH * 2))
    expect(out.length).toBeLessThanOrEqual(MAX_LOGIN_CSS_LENGTH)
  })

  it('handles empty and non-string input', () => {
    expect(sanitizeLoginCss('')).toBe('')
    expect(sanitizeLoginCss(null)).toBe('')
    expect(sanitizeLoginCss({})).toBe('')
  })
})
