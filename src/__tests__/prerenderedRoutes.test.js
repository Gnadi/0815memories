/* A pre-rendered page is only served if vercel.json routes its path to the
   built file, ahead of the catch-all SPA rewrite. Miss one and the page is
   served the landing page's HTML again: the marketing page flashes before it
   and crawlers index the landing page's title under its URL. */
import { describe, it, expect } from 'vitest'
import vercel from '../../vercel.json'
import sitemap from '../../public/sitemap.xml?raw'
import { PRERENDERED_PATHS } from '../prerenderedRoutes'
import { LANDING_PATHS } from '../i18n'
import { routes } from '../App'

const catchAll = vercel.rewrites.findIndex((r) => r.source === '/(.*)')

describe('pre-rendered pages', () => {
  it.each(PRERENDERED_PATHS.filter((p) => p !== '/'))('%s is served its own HTML', (path) => {
    const index = vercel.rewrites.findIndex((r) => r.source === path)
    expect(index).toBeGreaterThan(-1)
    expect(vercel.rewrites[index].destination).toBe(`${path}.html`)
    expect(index).toBeLessThan(catchAll)
  })

  it.each(PRERENDERED_PATHS.filter((p) => p !== '/'))('%s is a real route', (path) => {
    expect(routes[0].children.some((r) => `/${r.path}` === path)).toBe(true)
  })

  // A language crawlers cannot find at an address of its own, in its own HTML,
  // does not exist for them.
  it.each(Object.entries(LANDING_PATHS))('the landing page in "%s" is pre-rendered at %s and in the sitemap', (lng, path) => {
    const url = `https://kaydo.app${path}`
    expect(PRERENDERED_PATHS).toContain(path)
    expect(sitemap).toContain(`<loc>${url}</loc>`)
    expect(sitemap).toContain(`hreflang="${lng}" href="${url}"`)
  })
})

// Lighthouse's Agentic Browsing audit asks for /.well-known/ai-catalog.json,
// and the catch-all answered it with the landing page's HTML and a 200, which
// it reports as "ARD manifest is invalid". Kaydo publishes no catalog, so what
// is not a file there has to be a 404, as /assets is.
describe('/.well-known', () => {
  it('is answered from files only, ahead of the catch-all', () => {
    const index = vercel.rewrites.findIndex((r) => r.source === '/.well-known/(.*)')
    expect(index).toBeGreaterThan(-1)
    expect(vercel.rewrites[index].destination).toBe('/.well-known/$1')
    expect(index).toBeLessThan(catchAll)
  })
})
