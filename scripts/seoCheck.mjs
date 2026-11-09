/**
 * Checks the pre-rendered HTML of an indexable page for what search engines
 * read first. A page that fails here would still look fine in a browser, which
 * is why the build checks it (scripts/seo-build.mjs) rather than a person.
 */
import { absoluteUrl, alternatesFor } from '../src/seoRoutes.js'

// Markup for claims a page cannot back up, or that Google no longer shows for
// a site like this one (FAQPage).
const FORBIDDEN_TYPES = ['AggregateRating', 'Review']

const count = (html, pattern) => (html.match(pattern) ?? []).length

/** The JSON-LD blocks of a page, each parsed; throws on one that is not JSON. */
export function jsonLdBlocks(html) {
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
  return blocks.map(([, json], i) => {
    try {
      return JSON.parse(json)
    } catch (err) {
      throw new Error(`JSON-LD block ${i + 1} is not valid JSON: ${err.message}`)
    }
  })
}

function typesIn(value, found = new Set()) {
  if (Array.isArray(value)) value.forEach((item) => typesIn(item, found))
  else if (value && typeof value === 'object') {
    if (value['@type']) [].concat(value['@type']).forEach((type) => found.add(type))
    Object.entries(value).forEach(([key, item]) => {
      if (key === 'aggregateRating' || key === 'review') found.add(key === 'review' ? 'Review' : 'AggregateRating')
      typesIn(item, found)
    })
  }
  return found
}

/** The problems with the HTML of the page at `path`; an empty list if none. */
export function checkPage(html, path) {
  const errors = []
  const expectOne = (what, pattern) => {
    const n = count(html, pattern)
    if (n !== 1) errors.push(`${what}: found ${n}, expected 1`)
  }
  expectOne('<title>', /<title[\s>]/g)
  expectOne('meta description', /<meta[^>]*name="description"/g)
  expectOne('canonical', /<link[^>]*rel="canonical"/g)
  expectOne('<h1>', /<h1[\s>]/g)

  const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/)?.[1]
  if (canonical && canonical !== absoluteUrl(path)) {
    errors.push(`canonical is ${canonical}, expected ${absoluteUrl(path)}`)
  }

  const alternates = [...html.matchAll(/<link[^>]*rel="alternate"[^>]*hreflang="([^"]*)"[^>]*href="([^"]*)"/g)]
    .map(([, lng, href]) => `${lng} ${href}`)
    .sort()
  const expected = alternatesFor(path).map(([lng, href]) => `${lng} ${href}`).sort()
  if (alternates.join('|') !== expected.join('|')) {
    errors.push(`hreflang is [${alternates.join(', ')}], expected [${expected.join(', ')}]`)
  }

  try {
    const types = typesIn(jsonLdBlocks(html))
    FORBIDDEN_TYPES.filter((type) => types.has(type)).forEach((type) => errors.push(`JSON-LD contains ${type}`))
  } catch (err) {
    errors.push(err.message)
  }
  return errors
}
