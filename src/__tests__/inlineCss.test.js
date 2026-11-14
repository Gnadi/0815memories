/**
 * The pre-rendered pages carry their stylesheet — scripts/inlineCss.mjs.
 */
import { describe, it, expect } from 'vitest'
import { inlineStylesheet } from '../../scripts/inlineCss.mjs'

const page = '<head><script type="module" src="/assets/app-1.js"></script><link rel="stylesheet" crossorigin="" href="/assets/app-1.css"><link rel="manifest" href="/m.webmanifest"></head>'

describe('inlineStylesheet', () => {
  it('replaces the stylesheet link with the file', () => {
    const out = inlineStylesheet(page, (href) => (href === '/assets/app-1.css' ? 'a{color:red}' : ''))
    expect(out).toContain('<style>a{color:red}</style>')
    expect(out).not.toContain('app-1.css')
    expect(out).toContain('<link rel="manifest"')
  })

  it('copies the CSS as it is, "$&" included', () => {
    expect(inlineStylesheet(page, () => 'a::after{content:"$&$1"}')).toContain('<style>a::after{content:"$&$1"}</style>')
  })

  it('leaves the page alone when the file cannot be read', () => {
    const read = () => { throw new Error('ENOENT') }
    expect(inlineStylesheet(page, read)).toBe(page)
  })

  it('leaves a page without a stylesheet link alone', () => {
    expect(inlineStylesheet('<head></head>', () => 'x')).toBe('<head></head>')
  })

  it('does not touch a stylesheet from elsewhere', () => {
    const external = '<link rel="stylesheet" href="https://fonts.example/x.css">'
    expect(inlineStylesheet(external, () => 'x')).toBe(external)
  })
})
