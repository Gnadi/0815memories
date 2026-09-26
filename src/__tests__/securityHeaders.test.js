/**
 * The security headers vercel.json sends with every page.
 *
 * The Content-Security-Policy is a baseline: it shuts what the app never uses
 * (plugins, <base>, framing, cross-origin form posts) and leaves scripts,
 * styles, images and connections alone. Those need a decision first — custom
 * login pages may load images from anywhere today — so a policy for them
 * belongs with that decision, not here.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// `globalThis.process` rather than the bare global: eslint gives files under
// src/ browser globals only.
const config = JSON.parse(readFileSync(join(globalThis.process.cwd(), 'vercel.json'), 'utf8'))

/** The headers of the catch-all rule, which every page gets. */
function pageHeaders() {
  const rule = config.headers.find((r) => r.source === '/(.*)')
  return Object.fromEntries(rule.headers.map(({ key, value }) => [key.toLowerCase(), value]))
}

function directives(policy) {
  return Object.fromEntries(
    policy
      .split(';')
      .map((part) => part.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...values]) => [name, values]),
  )
}

describe('security headers', () => {
  it('send a Content-Security-Policy with the baseline directives', () => {
    const csp = directives(pageHeaders()['content-security-policy'] ?? '')
    expect(csp['object-src']).toEqual(["'none'"])
    expect(csp['base-uri']).toEqual(["'self'"])
    // Peecho's print button posts the order to its checkout as a form — the
    // one cross-origin form post the app makes (PeechoPrintButton).
    expect(csp['form-action']).toEqual(["'self'", 'https://secure.print.peecho.com'])
    expect(csp['frame-ancestors']).toEqual(["'none'"])
  })

  it('do not restrict scripts, styles, images or connections without a decision', () => {
    // A default-src or script-src here would silently break Firebase,
    // Cloudinary, the decrypt worker or a family's custom login page.
    const csp = directives(pageHeaders()['content-security-policy'] ?? '')
    for (const name of ['default-src', 'script-src', 'style-src', 'img-src', 'connect-src']) {
      expect(csp[name], name).toBeUndefined()
    }
  })

  it('no longer send the obsolete X-XSS-Protection', () => {
    // Current browsers ignore it; in the ones that did not, `mode=block` was
    // itself a way to make a page misbehave on purpose.
    expect(pageHeaders()['x-xss-protection']).toBeUndefined()
  })
})
