/* What search engines are told about kaydo.app: one address per page, no
   family's subdomain in the index, a sitemap that matches the pages, and
   pre-rendered HTML that says what each page is (scripts/seoCheck.mjs). */
import { describe, it, expect } from 'vitest'
import vercel from '../../vercel.json'
import robots from '../../public/robots.txt?raw'
import { buildSitemap } from '../../scripts/sitemap.mjs'
import { checkPage, jsonLdBlocks } from '../../scripts/seoCheck.mjs'
import { INDEXABLE_PATHS, alternatesFor, pathLanguage, SITE_ORIGIN } from '../seoRoutes'
import { PRERENDERED_PATHS } from '../prerenderedRoutes'

// Vercel matches a `has`/`missing` host value as a regular expression.
const hostMatches = (condition, host) => new RegExp(`^(?:${condition.value})$`).test(host)

function headersFor(host) {
  return vercel.headers
    .filter((rule) => rule.source === '/(.*)')
    .filter((rule) => (rule.has ?? []).every((c) => c.type !== 'host' || hostMatches(c, host)))
    .filter((rule) => !(rule.missing ?? []).some((c) => c.type === 'host' && hostMatches(c, host)))
    .flatMap((rule) => rule.headers)
}

describe('host redirects', () => {
  it('send www to the bare domain, keeping the path, permanently', () => {
    const rule = vercel.redirects.find((r) => r.has?.some((c) => c.type === 'host' && c.value === 'www.kaydo.app'))
    expect(rule).toBeDefined()
    expect(rule.source).toBe('/:path(.*)')
    expect(rule.destination).toBe('https://kaydo.app/:path')
    expect(rule.permanent).toBe(true)
    expect(vercel.redirects.indexOf(rule)).toBe(0)
  })

  it('send the old ?lang=de address of the German landing page to /de', () => {
    const rule = vercel.redirects.find((r) => r.destination === '/de')
    expect(rule.source).toBe('/')
    expect(rule.has).toEqual([{ type: 'query', key: 'lang', value: 'de' }])
    expect(rule.permanent).toBe(true)
  })
})

describe('family subdomains', () => {
  const robotsHeader = (host) => headersFor(host).find((h) => h.key === 'X-Robots-Tag')?.value

  it.each(['the-millers.kaydo.app', 'the-bennetts.kaydo.app', 'a-b.kaydo.app'])('%s is kept out of the index', (host) => {
    expect(robotsHeader(host)).toBe('noindex, nofollow')
  })

  it.each(['kaydo.app', 'www.kaydo.app', 'kaydo-git-main.vercel.app'])('%s is not', (host) => {
    expect(robotsHeader(host)).toBeUndefined()
  })

  it('are not blocked in robots.txt, or crawlers could not read the noindex', () => {
    expect(robots).not.toMatch(/Disallow:\s*\S/)
  })
})

describe('robots.txt', () => {
  it('allows everything and names the sitemap', () => {
    expect(robots).toMatch(/User-agent: \*\s+Allow: \//)
    expect(robots).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`)
  })
})

describe('sitemap', () => {
  const sitemap = buildSitemap()
  const locs = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map(([, url]) => url)

  it('lists every indexable page once, and only those', () => {
    expect(locs).toEqual(INDEXABLE_PATHS.map((path) => `${SITE_ORIGIN}${path}`))
    expect(new Set(locs).size).toBe(locs.length)
  })

  it('lists only the bare domain, with no query string', () => {
    for (const url of locs) {
      expect(url.startsWith(`${SITE_ORIGIN}/`)).toBe(true)
      expect(url).not.toContain('?')
    }
  })

  it('gives a page in two languages its alternates and x-default', () => {
    const entry = sitemap.split('<url>').find((block) => block.includes(`<loc>${SITE_ORIGIN}/de</loc>`))
    expect(entry).toContain(`hreflang="en" href="${SITE_ORIGIN}/"`)
    expect(entry).toContain(`hreflang="de" href="${SITE_ORIGIN}/de"`)
    expect(entry).toContain(`hreflang="x-default" href="${SITE_ORIGIN}/"`)
  })

  it('pre-renders exactly the pages it lists', () => {
    expect(PRERENDERED_PATHS).toEqual(INDEXABLE_PATHS)
  })
})

describe('language of an address', () => {
  it('is fixed by every page in two languages except "/"', () => {
    expect(pathLanguage('/')).toBeUndefined()
    expect(pathLanguage('/de')).toBe('de')
    expect(pathLanguage('/terms')).toBeUndefined()
    expect(pathLanguage('/home')).toBeUndefined()
  })

  it('has alternates only where there is a second language', () => {
    expect(alternatesFor('/terms')).toEqual([])
    expect(alternatesFor('/de').map(([lng]) => lng)).toEqual(['en', 'de', 'x-default'])
  })
})

describe('pre-rendered HTML check', () => {
  const page = ({ ld = '{"@context":"https://schema.org","@type":"WebSite","name":"Kaydo"}', extra = '' } = {}) => `
    <html><head><title>Kaydo</title><meta name="description" content="x">
    <link rel="canonical" href="https://kaydo.app/de">
    <link rel="alternate" hreflang="en" href="https://kaydo.app/">
    <link rel="alternate" hreflang="de" href="https://kaydo.app/de">
    <link rel="alternate" hreflang="x-default" href="https://kaydo.app/">
    <script type="application/ld+json">${ld}</script>${extra}</head><body><h1>Hi</h1></body></html>`

  it('passes a complete page', () => {
    expect(checkPage(page(), '/de')).toEqual([])
  })

  it('finds a second title, a wrong canonical and missing alternates', () => {
    expect(checkPage(page({ extra: '<title>Again</title>' }), '/de')).toEqual(['<title>: found 2, expected 1'])
    expect(checkPage(page(), '/')).toContain('canonical is https://kaydo.app/de, expected https://kaydo.app/')
    expect(checkPage(page(), '/terms')[0]).toMatch(/^canonical/)
    expect(checkPage(page(), '/terms')[1]).toMatch(/^hreflang/)
  })

  it('fails on JSON-LD that does not parse', () => {
    expect(() => jsonLdBlocks(page({ ld: '{"@type": "WebSite",}' }))).toThrow(/not valid JSON/)
    expect(checkPage(page({ ld: '{' }), '/de')[0]).toMatch(/JSON-LD block 1 is not valid JSON/)
  })

  it('fails on rating or review markup', () => {
    expect(checkPage(page({ ld: '{"@type":"WebApplication","aggregateRating":{"ratingValue":5}}' }), '/de'))
      .toEqual(['JSON-LD contains AggregateRating'])
  })
})
