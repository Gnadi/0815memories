/* Logging in once should keep you in your family — closing the tab, quitting
   the browser, or swiping the PWA away included.

   Two defects broke that promise, and they compounded: "/" always rendered the
   marketing landing page, so a returning member looked logged out even though
   the session was intact (pressing "Login" then dropped them into the app with
   no password, because they had never actually been signed out); and the "Stay
   logged in" box wrote a sessionStorage flag nothing ever read, so it decided
   nothing at all.

   These tests pin the root route's decision and the storage the box selects. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'

vi.mock('../config/firebase', () => ({ db: null, auth: null, getMessagingInstance: () => Promise.resolve(null) }))
// vite-react-ssg's <Head> needs the SSG helmet context, absent in jsdom tests.
vi.mock('vite-react-ssg', () => ({ Head: () => null }))

const auth = { isAuthenticated: false, loading: true }
vi.mock('../context/AuthContext', () => ({
  useAuth: () => auth,
  AuthProvider: ({ children }) => children,
}))

import { RootRoute } from '../App'
import {
  readStored, writeStored, clearStoredSession, setSessionOnly,
  hasStoredSession, isSessionOnly,
} from '../utils/authStorage'

function renderRoot() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <RootRoute /> },
      { path: '/home', element: <div>the app</div> },
      { path: '/login', element: <div>the login page</div> },
    ],
    { initialEntries: ['/'] },
  )
  return render(<RouterProvider router={router} />)
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  Object.assign(auth, { isAuthenticated: false, loading: true })
})

afterEach(cleanup)

describe('what "/" shows a returning visitor', () => {
  it('sends a signed-in member to the app instead of the landing page', async () => {
    localStorage.setItem('fh_familyId', 'fam1')
    Object.assign(auth, { isAuthenticated: true, loading: false })

    renderRoot()

    expect(await screen.findByText('the app')).toBeInTheDocument()
  })

  it('holds the landing page back while the stored session is still rehydrating', async () => {
    // Firebase Auth has not answered yet: isAuthenticated is false but only
    // because the token is still being read back. Showing the marketing page
    // here is the flash that made the app look logged out on every launch.
    localStorage.setItem('fh_familyId', 'fam1')
    Object.assign(auth, { isAuthenticated: false, loading: true })

    renderRoot()

    await waitFor(() => {
      expect(document.body.textContent).not.toMatch(/Keep every family memory|Explore the demo family/i)
    })

    // …and once the token lands, straight into the app.
    Object.assign(auth, { isAuthenticated: true, loading: false })
    renderRoot()
    expect(await screen.findByText('the app')).toBeInTheDocument()
  })

  it('falls through to the landing page when the stored family outlived its session', async () => {
    // Signed out in another tab: the id lingers, the session does not.
    localStorage.setItem('fh_familyId', 'fam1')
    Object.assign(auth, { isAuthenticated: false, loading: false })

    renderRoot()

    expect(await screen.findByText('Frequently asked questions')).toBeInTheDocument()
  })

  it('still shows the landing page to a visitor with no session', async () => {
    Object.assign(auth, { isAuthenticated: false, loading: false })

    renderRoot()

    expect(await screen.findByText('Frequently asked questions')).toBeInTheDocument()
  })
})

describe('the store "Stay logged in" picks', () => {
  it('remembers a session past the window when the box is checked', () => {
    setSessionOnly(false)
    writeStored('fh_familyId', 'fam1')

    expect(localStorage.getItem('fh_familyId')).toBe('fam1')
    expect(sessionStorage.getItem('fh_familyId')).toBeNull()
    expect(hasStoredSession()).toBe(true)
  })

  it('keeps a session inside the window when the box is cleared', () => {
    setSessionOnly(true)
    writeStored('fh_familyId', 'fam1')
    writeStored('fh_viewer', 'true')

    expect(sessionStorage.getItem('fh_familyId')).toBe('fam1')
    expect(localStorage.getItem('fh_familyId')).toBeNull()
    expect(isSessionOnly()).toBe(true)
    // Readable for as long as this window lives — a new one starts clean.
    expect(readStored('fh_viewer')).toBe('true')
  })

  it('never leaves a session in both stores when the choice changes', () => {
    setSessionOnly(false)
    writeStored('fh_familyId', 'remembered')
    setSessionOnly(true)
    writeStored('fh_familyId', 'this-window-only')

    expect(localStorage.getItem('fh_familyId')).toBeNull()
    expect(readStored('fh_familyId')).toBe('this-window-only')
  })

  it('clears both stores on logout', () => {
    setSessionOnly(false)
    writeStored('fh_familyId', 'fam1')
    writeStored('fh_cardStyle', 'polaroid')
    setSessionOnly(true)
    writeStored('fh_viewer', 'true')

    clearStoredSession()

    expect(hasStoredSession()).toBe(false)
    expect(isSessionOnly()).toBe(false)
    for (const key of ['fh_familyId', 'fh_viewer', 'fh_cardStyle']) {
      expect(localStorage.getItem(key)).toBeNull()
      expect(sessionStorage.getItem(key)).toBeNull()
    }
  })
})
