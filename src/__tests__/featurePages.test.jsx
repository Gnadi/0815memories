/* The feature pages (src/seoRoutes.js): each renders in its address's
   language, says plainly what it is about, links the demo, sign-up, its
   sibling pages and home, and promises nothing the landing page does not. */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import i18n from '../i18n'
import { FEATURE_PAGES, pathLanguage } from '../seoRoutes'
import { routes } from '../App'
import vercel from '../../vercel.json'
import enFeatures from '../locales/en/features.json'
import deFeatures from '../locales/de/features.json'

// vite-react-ssg's <Head> needs the SSG helmet context, absent in jsdom tests;
// the pre-rendered head is checked on the build (scripts/seoCheck.mjs).
vi.mock('vite-react-ssg', () => ({ Head: () => null }))

import FeaturePage from '../pages/FeaturePage'
import LandingPage from '../pages/LandingPage'

vi.mock('../config/firebase', () => ({ db: null, auth: null, messaging: null }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, signup: vi.fn(), firebaseReady: false }),
}))

const COPY = { en: enFeatures, de: deFeatures }
const cases = FEATURE_PAGES.flatMap((page) => Object.keys(page.paths).map((lng) => [page.id, lng]))

function renderPage(id, lng) {
  const page = FEATURE_PAGES.find((p) => p.id === id)
  const router = createMemoryRouter(
    [{ path: page.paths[lng], element: <FeaturePage id={id} lng={lng} /> }, { path: '*', element: null }],
    { initialEntries: [page.paths[lng]] },
  )
  render(<RouterProvider router={router} />)
}

const words = (copy) =>
  [copy.h1, copy.intro, ...copy.sections.flatMap((s) => [s.heading, ...s.paragraphs])].join(' ').split(/\s+/).length

describe('feature pages', () => {
  afterEach(() => cleanup())

  it.each(cases)('%s renders in %s with one H1 and its sections', (id, lng) => {
    renderPage(id, lng)
    const copy = COPY[lng].pages[id]
    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0].textContent).toBe(copy.h1)
    for (const section of copy.sections) expect(screen.getByRole('heading', { name: section.heading })).toBeInTheDocument()
    expect(screen.getByAltText(copy.imageAlt).getAttribute('src')).toMatch(lng === 'de' ? /^\/screenshots\/de\// : /^\/screenshots\/[^/]+\.webp$/)
  })

  it.each(cases)('%s in %s links the demo, sign-up, the other pages and home', (id, lng) => {
    renderPage(id, lng)
    const t = COPY[lng]
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(screen.getAllByRole('link', { name: t.cta.demo })[0].getAttribute('href')).toBe('/demo')
    expect(screen.getAllByRole('link', { name: t.cta.getStarted })[0].getAttribute('href')).toBe('/signup')
    for (const other of FEATURE_PAGES) expect(hrefs).toContain(other.paths[lng])
    expect(hrefs).toContain(lng === 'de' ? '/de' : '/')
  })

  it.each(cases)('%s in %s is within its length limits', (id, lng) => {
    const copy = COPY[lng].pages[id]
    expect(copy.seoTitle.length).toBeLessThanOrEqual(60)
    expect(copy.seoDescription.length).toBeLessThanOrEqual(155)
    expect(copy.seoTitle).toContain('Kaydo')
    expect(copy.seoDescription).toContain('Kaydo')
    expect(copy.sections.length).toBeGreaterThanOrEqual(3)
    expect(copy.sections.length).toBeLessThanOrEqual(5)
    expect(words(copy)).toBeGreaterThan(380)
    expect(words(copy)).toBeLessThan(700)
  })

  it.each(Object.entries(COPY))('makes no claims the site does not make (%s)', (lng, copy) => {
    const text = JSON.stringify(copy)
    expect(text).not.toMatch(/military-grade|zero-knowledge|\d+[,.]?\d*\s*(families|users|Familien|Nutzer)|★|rating|Bewertung/i)
  })

  it('reads its address as its language', () => {
    for (const page of FEATURE_PAGES) {
      expect(pathLanguage(page.paths.en)).toBe('en')
      expect(pathLanguage(page.paths.de)).toBe('de')
    }
  })

  it('are routes, each served its own pre-rendered file', () => {
    const children = routes[0].children.map((r) => `/${r.path}`)
    for (const page of FEATURE_PAGES) {
      for (const path of Object.values(page.paths)) {
        expect(children).toContain(path)
        expect(vercel.rewrites.find((r) => r.source === path)?.destination).toBe(`${path}.html`)
      }
    }
  })
})

describe('the landing page links the feature pages', () => {
  afterEach(() => {
    cleanup()
    i18n.changeLanguage('en')
  })

  it.each([['/', 'en'], ['/de', 'de']])('from its cards and footer (%s)', async (path, lng) => {
    await i18n.changeLanguage(lng)
    const router = createMemoryRouter(
      [{ path, element: <LandingPage lng={lng === 'de' ? 'de' : undefined} /> }, { path: '*', element: null }],
      { initialEntries: [path] },
    )
    render(<RouterProvider router={router} />)
    const footer = screen.getByRole('contentinfo')
    for (const page of FEATURE_PAGES) {
      const name = COPY[lng].pages[page.id].name
      const links = screen.getAllByRole('link', { name: new RegExp(`^${name}`) })
      // One in the feature card, one in the footer.
      expect(links).toHaveLength(2)
      for (const link of links) expect(link.getAttribute('href')).toBe(page.paths[lng])
      expect(within(footer).getByRole('link', { name })).toBeInTheDocument()
    }
  })
})
