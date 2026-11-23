import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { safeNextPath, loginPathFor } from '../utils/nextPath'

/**
 * Signing in from a link into the app.
 *
 * A signed-out visitor who opened a page inside the app — a memory someone
 * shared — was sent to the landing page, and signing in from there ended on
 * /home rather than on the memory. The page they were going to now rides
 * along as ?next=, which only ever names a page on this site.
 */

const auth = vi.hoisted(() => ({ current: {} }))
const loginAsAdmin = vi.fn()

// Head needs the HelmetProvider only the real app sets up. Passed through,
// React itself moves the <title> into <head>.
vi.mock('vite-react-ssg', () => ({ Head: ({ children }) => <>{children}</> }))
vi.mock('../config/firebase', () => ({ db: null, auth: null, functions: null }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.current }))
vi.mock('../utils/familySlug', () => ({ getSubdomainSlug: () => null }))
vi.mock('../services/family', () => ({
  resolveFamilyBySlug: vi.fn(async () => null),
  getFamilyPublic: vi.fn(async () => null),
}))

import LoginPage from '../pages/LoginPage'
import ProtectedRoute from '../components/layout/ProtectedRoute'

function Where() {
  const { pathname, search } = useLocation()
  return <p data-testid="where">{pathname + search}</p>
}

function renderAt(entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/memory/:id" element={<ProtectedRoute><p>the memory</p></ProtectedRoute>} />
        <Route path="/home" element={<ProtectedRoute><p>home</p></ProtectedRoute>} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

const signedOut = {
  isAuthenticated: false, loading: false, firebaseReady: true,
  loginAsViewer: vi.fn(), loginAsAdmin, sendAdminPasswordReset: vi.fn(),
}

describe('safeNextPath', () => {
  it.each([
    '/memory/abc', '/recipes/r1?v=2', '/home',
  ])('accepts %s', (path) => expect(safeNextPath(path)).toBe(path))

  it.each([
    null, '', 'memory/abc', 'https://evil.example', '//evil.example', '/\\evil.example',
    '/\t/evil.example', 'javascript:alert(1)', '/login?next=/x', '/signup', '/login',
  ])('rejects %j', (path) => expect(safeNextPath(path)).toBeNull())

  it('round-trips through loginPathFor', () => {
    const login = loginPathFor({ pathname: '/memory/abc', search: '?photo=2' })
    const next = new URLSearchParams(login.split('?')[1]).get('next')
    expect(safeNextPath(next)).toBe('/memory/abc?photo=2')
  })
})

describe('signing in from a link into the app', () => {
  beforeEach(() => {
    window.localStorage.clear()
    loginAsAdmin.mockReset()
    auth.current = { ...signedOut }
  })

  it('sends a signed-out visitor of a page to the login page, which remembers it', async () => {
    renderAt('/memory/abc?photo=2')
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    // The login page is showing; the admin form signs in and goes back.
    fireEvent.click(screen.getByRole('button', { name: 'Sign in as admin' }))
    loginAsAdmin.mockImplementation(async () => {
      auth.current = { ...auth.current, isAuthenticated: true, familyId: 'fam1', keyLoading: false }
    })
    fireEvent.change(screen.getByLabelText('Family Email'), { target: { value: 'a@example.com' } })
    fireEvent.change(screen.getByLabelText('Private Key'), { target: { value: 'secret-secret' } })
    fireEvent.submit(screen.getByLabelText('Private Key').closest('form'))
    expect(await screen.findByText('the memory')).toBeInTheDocument()
  })

  it('still sends a signed-out visit of /home to the landing page', async () => {
    renderAt('/home')
    expect(await screen.findByTestId('where')).toHaveTextContent(/^\/$/)
  })

  it('goes to /home when ?next= names another site', async () => {
    loginAsAdmin.mockImplementation(async () => {
      auth.current = { ...auth.current, isAuthenticated: true, familyId: 'fam1', keyLoading: false }
    })
    renderAt('/login?admin=1&next=%2F%2Fevil.example')
    fireEvent.change(await screen.findByLabelText('Family Email'), { target: { value: 'a@example.com' } })
    fireEvent.change(screen.getByLabelText('Private Key'), { target: { value: 'secret-secret' } })
    fireEvent.submit(screen.getByLabelText('Private Key').closest('form'))
    expect(await screen.findByText('home')).toBeInTheDocument()
  })

  it('sends a visitor who is already signed in straight on', async () => {
    auth.current = { ...signedOut, isAuthenticated: true, familyId: 'fam1', keyLoading: false }
    renderAt('/login?next=%2Fmemory%2Fabc')
    expect(await screen.findByText('the memory')).toBeInTheDocument()
  })
})

describe('the login page without a family link', () => {
  beforeEach(() => {
    window.localStorage.clear()
    auth.current = { ...signedOut }
  })

  it('explains where the family login is instead of showing a key field', async () => {
    const { container } = renderAt('/login')
    expect(await screen.findByText("Open your family's link")).toBeInTheDocument()
    expect(container.querySelector('input[type="password"]')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Sign in as admin' }))
    expect(screen.getByLabelText('Family Email')).toBeInTheDocument()
  })

  it('keeps the admin login short where there is no family to go back to', async () => {
    renderAt('/login?admin=1')
    await screen.findByLabelText('Family Email')
    // It led to the notice asking for a link, and cost a phone a line.
    expect(screen.queryByRole('button', { name: 'Back to family login' })).toBeNull()
    // Signing up is a link in one line, not a second big button.
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/signup')
    expect(screen.queryByRole('button', { name: 'Create an account' })).toBeNull()
  })

  it('names itself in the tab', async () => {
    renderAt('/login')
    await screen.findByRole('heading', { level: 1 })
    expect(document.title).toBe('Sign in – Kaydo')
  })

  it('links its footer to pages that exist', async () => {
    renderAt('/login')
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy-policy')
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms')
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact')
    expect(screen.getAllByRole('link', { name: 'Kaydo home page' })[0]).toHaveAttribute('href', '/')
  })

  it('warns when Caps Lock is on while typing the key', async () => {
    renderAt('/login?admin=1')
    const key = await screen.findByLabelText('Private Key')
    key.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, modifierCapsLock: false }))
    expect(screen.queryByText('Caps Lock is on')).toBeNull()
    key.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', bubbles: true, modifierCapsLock: true }))
    expect(await screen.findByText('Caps Lock is on')).toBeInTheDocument()
    key.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true, modifierCapsLock: false }))
    await waitFor(() => expect(screen.queryByText('Caps Lock is on')).toBeNull())
  })
})
