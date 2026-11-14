import { describe, expect, it } from 'vitest'
import { safeHref } from '../utils/safeHref'

describe('safeHref', () => {
  it('allows http, https and mailto', () => {
    expect(safeHref('http://example.com/a')).toBe('http://example.com/a')
    expect(safeHref('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
    expect(safeHref('mailto:grandma@example.com')).toBe('mailto:grandma@example.com')
  })

  it('rejects script-capable and other schemes', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull()
    expect(safeHref('  JavaScript:alert(1)')).toBeNull()
    expect(safeHref('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(safeHref('vbscript:msgbox(1)')).toBeNull()
  })

  it('rejects unparseable input', () => {
    expect(safeHref('http://')).toBeNull()
    expect(safeHref('')).toBeNull()
  })

  it('rejects non-strings', () => {
    expect(safeHref(undefined)).toBeNull()
    expect(safeHref(null)).toBeNull()
    expect(safeHref(42)).toBeNull()
    expect(safeHref({})).toBeNull()
  })

  it('lets relative URLs through, since they resolve against our own origin', () => {
    expect(safeHref('/albums/1')).toBe('/albums/1')
    expect(safeHref('example.com')).toBe('example.com')
  })
})
