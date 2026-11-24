/**
 * The birth sky without an account — pages/PublicBirthSkyPage.jsx, the way in
 * from the landing page.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PublicBirthSkyPage from '../pages/PublicBirthSkyPage'
import { SKY_DRAFT_KEY } from '../utils/sky/skyDraft'
import { BIRTH_SKY_PATHS, INDEXABLE_PATHS, alternatesFor, pathLanguage } from '../seoRoutes'
import { routes } from '../App'
import vercel from '../../vercel.json'
import enSky from '../locales/en/sky.json'
import deSky from '../locales/de/sky.json'
import frSky from '../locales/fr/sky.json'
import arSky from '../locales/ar/sky.json'

const LANGUAGES = [['en', enSky], ['de', deSky], ['fr', frSky], ['ar', arSky]]

vi.mock('vite-react-ssg', () => ({ Head: () => null }))
let mockAuth
vi.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }))
vi.mock('../utils/printBook', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, printConfig: () => ({ ...actual.printConfig({}), enabled: true }) }
})
vi.mock('../utils/sky/skyData', async (importOriginal) => ({
  ...(await importOriginal()),
  loadSkyCatalog: () => Promise.resolve({ stars: [[37.95, 89.26, 1.97, 0.6]], constellations: [] }),
}))

function renderPage(lng = 'en') {
  return render(
    <MemoryRouter initialEntries={[BIRTH_SKY_PATHS[lng]]}>
      <Routes>
        <Route path={BIRTH_SKY_PATHS[lng]} element={<PublicBirthSkyPage lng={lng} />} />
        <Route path="/signup" element={<p>signup page</p>} />
        <Route path="/login" element={<p>login page</p>} />
        <Route path="/birth-sky/continue" element={<p>continue page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

function fillIn() {
  fireEvent.change(screen.getByLabelText("Child's name"), { target: { value: 'Leo' } })
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-20' } })
  fireEvent.change(screen.getByLabelText('Time of birth'), { target: { value: '04:17' } })
  fireEvent.click(screen.getByText('Not in the list? Enter coordinates'))
  fireEvent.change(screen.getByPlaceholderText('Name (e.g. St. Wolfgang)'), { target: { value: 'Linz' } })
  fireEvent.change(screen.getByPlaceholderText('Latitude'), { target: { value: '48.30639' } })
  fireEvent.change(screen.getByPlaceholderText('Longitude'), { target: { value: '14.28611' } })
  fireEvent.click(screen.getByText('Use these coordinates'))
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  localStorage.clear()
  mockAuth = { isAuthenticated: false, isAdmin: false, familyId: null }
})

describe('PublicBirthSkyPage', () => {
  it('needs the birth before anything can be downloaded or kept', async () => {
    renderPage()
    expect(screen.getByText('Download PDF (A4)').closest('button')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Create a free account and order' })).toBeDisabled()
    expect(await screen.findByText('Choose the place of birth to see the sky.')).toBeInTheDocument()
  })

  it('lets anyone download it once the birth is in, and titles it with the name', async () => {
    renderPage()
    fillIn()
    await waitFor(() => expect(screen.getByText('Download PDF (A4)').closest('button')).toBeEnabled())
    expect(screen.getByLabelText('Title')).toHaveValue('Leo')
    // Nothing is kept in the browser until the visitor asks for it.
    expect(localStorage.getItem(SKY_DRAFT_KEY)).toBeNull()
  })

  it('keeps the poster through signing up, to be ordered', async () => {
    renderPage()
    fillIn()
    fireEvent.change(screen.getByLabelText('A line of your own'), { target: { value: 'Willkommen' } })
    const order = screen.getByRole('button', { name: 'Create a free account and order' })
    await waitFor(() => expect(order).toBeEnabled())
    fireEvent.click(order)

    expect(screen.getByText('signup page')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(SKY_DRAFT_KEY))).toMatchObject({
      name: 'Leo',
      birthDate: '2026-11-20',
      birthTime: '04:17',
      birthPlace: { name: 'Linz', lat: 48.31, lon: 14.29, tz: 'Europe/Vienna' },
      title: 'Leo',
      dedication: 'Willkommen',
      order: true,
    })
  })

  it('takes a signed-in admin straight to their family', async () => {
    mockAuth = { isAuthenticated: true, isAdmin: true, familyId: 'fam-1' }
    renderPage()
    fillIn()
    const order = screen.getByRole('button', { name: 'Create a free account and order' })
    await waitFor(() => expect(order).toBeEnabled())
    fireEvent.click(order)
    expect(screen.getByText('continue page')).toBeInTheDocument()
  })

  it('opens at its top, wherever the page that linked to it was scrolled', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    renderPage()
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('shows a finished poster until there is a sky of its own', async () => {
    renderPage()
    expect(screen.getByAltText(enSky.public.exampleAlt).getAttribute('src')).toBe('/screenshots/birth-sky-poster.webp')
    fillIn()
    await waitFor(() => expect(screen.queryByAltText(enSky.public.exampleAlt)).not.toBeInTheDocument())
  })
})

const words = (copy) =>
  copy.sections
    .flatMap((s) => [s.heading, ...s.paragraphs, s.printParagraph ?? ''])
    .join(' ')
    .split(/\s+/).length

describe('the birth sky for search engines', () => {
  it.each(LANGUAGES)('renders in its address’s language (%s), with one H1 and its sections', (lng, copy) => {
    renderPage(lng)
    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0].textContent).toBe(copy.public.heading)
    expect(screen.getByRole('heading', { level: 2, name: copy.public.faqTitle })).toBeInTheDocument()
    // Folded, as on the landing page, with every answer in the page.
    for (const section of copy.public.sections) {
      const question = screen.getByText(section.heading)
      expect(question.tagName).toBe('SUMMARY')
      expect(question.closest('details')).not.toHaveAttribute('open')
      expect(question.closest('details')).toHaveTextContent(section.paragraphs[0])
    }
    // The place picker and the other parts speak the page's language too.
    expect(screen.getByText(copy.details.place)).toBeInTheDocument()
    // The example poster is in German or English; other languages show the English one.
    expect(screen.getByAltText(copy.public.exampleAlt).getAttribute('src')).toMatch(
      lng === 'de' ? /^\/screenshots\/de\// : /^\/screenshots\/[^/]+\.webp$/,
    )
  })

  it.each(LANGUAGES)('stays within the length limits (%s)', (lng, copy) => {
    expect(copy.public.seoTitle.length).toBeLessThanOrEqual(60)
    expect(copy.public.seoDescription.length).toBeLessThanOrEqual(155)
    expect(copy.public.seoTitle).toContain('Kaydo')
    expect(words(copy.public)).toBeGreaterThan(380)
    expect(words(copy.public)).toBeLessThan(700)
  })

  it('is indexed in both languages, each pointing at the other', () => {
    expect(INDEXABLE_PATHS).toEqual(expect.arrayContaining(Object.values(BIRTH_SKY_PATHS)))
    for (const [lng, path] of Object.entries(BIRTH_SKY_PATHS)) expect(pathLanguage(path)).toBe(lng)
    expect(alternatesFor('/de/geburtshimmel').map(([lng]) => lng)).toEqual(['en', 'de', 'fr', 'ar', 'x-default'])
  })

  it('is a route served its own pre-rendered file, and the old address redirects', () => {
    const children = routes[0].children.map((r) => `/${r.path}`)
    for (const path of Object.values(BIRTH_SKY_PATHS)) {
      expect(children).toContain(path)
      expect(vercel.rewrites.find((r) => r.source === path)?.destination).toBe(`${path}.html`)
    }
    expect(vercel.redirects.find((r) => r.source === '/geburtshimmel')).toMatchObject({
      destination: '/de/geburtshimmel',
      permanent: true,
    })
  })
})
