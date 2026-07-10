/* Smoke test: the landing page renders in both languages, carries the
   demo CTA / two-zone / trust sections, and stays free of retired claims
   (invite-only, military-grade, zero-knowledge, breach stats). */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
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
  const router = createMemoryRouter([{ path: '/', element: <LandingPage /> }])
  return render(<RouterProvider router={router} />)
}

describe('LandingPage renders in both languages', () => {
  afterEach(() => {
    cleanup()
    i18n.changeLanguage('en')
  })

  it('renders English with demo CTA, two-zone section and trust badges', () => {
    renderLanding()
    expect(screen.getByText('Explore the demo family')).toBeInTheDocument()
    expect(screen.getByText('Two zones, one home')).toBeInTheDocument()
    expect(screen.getByText('Everyday ease')).toBeInTheDocument()
    expect(screen.getByText('Vault-grade privacy')).toBeInTheDocument()
    expect(screen.getByText('GDPR-compliant')).toBeInTheDocument()
    expect(screen.getAllByText(/AES-256/).length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toMatch(/invite-only|military-grade|zero-knowledge|data breaches/i)
  })

  it('renders German with demo CTA, two-zone section and DSGVO badge', async () => {
    await i18n.changeLanguage('de')
    renderLanding()
    expect(screen.getByText('Demo-Familie ansehen')).toBeInTheDocument()
    expect(screen.getByText('Zwei Zonen, ein Zuhause')).toBeInTheDocument()
    expect(screen.getByText('DSGVO-konform')).toBeInTheDocument()
    expect(screen.getAllByText(/AES-256/).length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toMatch(/nur auf Einladung|Zero-Knowledge|Datenlecks/i)
  })
})
