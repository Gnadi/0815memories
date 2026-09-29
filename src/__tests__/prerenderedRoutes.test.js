/* A pre-rendered page is only served if vercel.json routes its path to the
   built file, ahead of the catch-all SPA rewrite. Miss one and the page is
   served the landing page's HTML again: the marketing page flashes before it
   and crawlers index the landing page's title under its URL. */
import { describe, it, expect } from 'vitest'
import vercel from '../../vercel.json'
import { PRERENDERED_PATHS } from '../prerenderedRoutes'
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
})
