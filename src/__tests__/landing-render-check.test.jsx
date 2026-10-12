/* Smoke test: the landing page renders in both languages, carries the
   demo CTA / two-zone / trust sections, and stays free of retired claims
   (invite-only, military-grade, zero-knowledge, breach stats). */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import i18n from '../i18n'

vi.mock('../config/firebase', () => ({ db: null, auth: null, messaging: null }))
// vite-react-ssg's <Head> needs the SSG helmet context, absent in jsdom tests.
vi.mock('vite-react-ssg', () => ({ Head: () => null }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, signup: vi.fn(), firebaseReady: false }),
}))

import LandingPage from '../pages/LandingPage'

function renderLanding() {
  const router = createMemoryRouter([
    { path: '/', element: <LandingPage /> },
    { path: '*', element: null },
  ])
  render(<RouterProvider router={router} />)
  return router
}

describe('LandingPage renders in both languages', () => {
  afterEach(() => {
    cleanup()
    i18n.changeLanguage('en')
  })

  it('renders English with demo CTAs, two-zone, app, FAQ and trust sections', () => {
    renderLanding()
    // Demo CTA appears in the hero and again in the closing CTA section.
    expect(screen.getAllByText('Explore the demo family').length).toBe(2)
    expect(screen.getByText('Two zones, one home')).toBeInTheDocument()
    expect(screen.getByText('Everyday ease')).toBeInTheDocument()
    expect(screen.getByText('Vault-grade privacy')).toBeInTheDocument()
    expect(screen.getByText('Works like an app')).toBeInTheDocument()
    expect(screen.getByText('Frequently asked questions')).toBeInTheDocument()
    expect(screen.getByText('Do grandparents need an account?')).toBeInTheDocument()
    expect(screen.getByText('GDPR-compliant')).toBeInTheDocument()
    expect(screen.getAllByText(/AES-256/).length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toMatch(/invite-only|military-grade|zero-knowledge|data breaches/i)
  })

  it('renders German with demo CTAs, two-zone, app, FAQ and DSGVO badge', async () => {
    await i18n.changeLanguage('de')
    renderLanding()
    expect(screen.getAllByText('Demo-Familie ansehen').length).toBe(2)
    expect(screen.getByText('Zwei Zonen, ein Zuhause')).toBeInTheDocument()
    expect(screen.getByText('Funktioniert wie eine App')).toBeInTheDocument()
    expect(screen.getByText('Häufige Fragen')).toBeInTheDocument()
    expect(screen.getByText('Brauchen Oma und Opa ein Konto?')).toBeInTheDocument()
    expect(screen.getByText('DSGVO-konform')).toBeInTheDocument()
    expect(screen.getAllByText(/AES-256/).length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toMatch(/nur auf Einladung|Zero-Knowledge|Datenlecks/i)
  })

  it('sends a visitor from a feature to the same place in the demo family', () => {
    const router = renderLanding()
    fireEvent.click(screen.getByText('Open Scrapbooks'))
    expect(router.state.location.pathname).toBe('/demo')
    expect(router.state.location.search).toBe('?to=/scrapbook')
  })

  it('shows the screenshots in the page\'s language', async () => {
    renderLanding()
    expect(screen.getByAltText(/scrapbook editor/).getAttribute('src')).toBe('/screenshots/scrapbook-desktop.webp')
    cleanup()
    await i18n.changeLanguage('de')
    renderLanding()
    expect(screen.getByAltText(/Scrapbook-Editor/).getAttribute('src')).toBe('/screenshots/de/scrapbook-desktop.webp')
  })

  it('links the story behind Kaydo, and says in English that it is German', async () => {
    renderLanding()
    const link = screen.getByText('Read the story behind it').closest('a')
    expect(link.getAttribute('href')).toBe('https://blog.gnadlinger.me/blog/kaydo/')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(screen.getByText('(in German)')).toBeInTheDocument()
    cleanup()
    await i18n.changeLanguage('de')
    renderLanding()
    expect(screen.getByText('Lies die Geschichte dahinter')).toBeInTheDocument()
    expect(screen.getByText('Die Geschichte hinter Kaydo').closest('a').getAttribute('href'))
      .toBe('https://blog.gnadlinger.me/blog/kaydo/')
  })
})
