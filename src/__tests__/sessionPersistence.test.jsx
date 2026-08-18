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
import { act, render, screen, cleanup, waitFor } from '@testing-library/react'
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
  document.documentElement.classList.remove('kaydo-restoring')
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
    // here is what made the app look logged out on every launch.
    localStorage.setItem('fh_familyId', 'fam1')
    Object.assign(auth, { isAuthenticated: false, loading: true })

    renderRoot()

    await waitFor(() => {
      expect(screen.queryByText('Frequently asked questions')).not.toBeInTheDocument()
    })
    // Held, not redirected — the session has not been confirmed yet.
    expect(screen.queryByText('the app')).not.toBeInTheDocument()
  })

  it('gives up on a session that never finishes restoring', async () => {
    // Auth that never settles used to mean a permanently blank "/" — worse than
    // the landing page it replaced. The valve falls through to the public page.
    vi.useFakeTimers()
    try {
      localStorage.setItem('fh_familyId', 'fam1')
      Object.assign(auth, { isAuthenticated: false, loading: true })

      renderRoot()
      // Settle the mount effect first: the valve is only armed once the route
      // has read storage and moved to 'restoring'. Advancing before that would
      // consume the wait while no timer was pending yet.
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      expect(screen.queryByText('Frequently asked questions')).not.toBeInTheDocument()

      await act(async () => { await vi.advanceTimersByTimeAsync(5001) })
      expect(screen.getByText('Frequently asked questions')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('falls through to the landing page when the stored family outlived its session', async () => {
    // Signed out in another tab: the id lingers, the session does not.
    localStorage.setItem('fh_familyId', 'fam1')
    Object.assign(auth, { isAuthenticated: false, loading: false })

    renderRoot()

    expect(await screen.findByText('Frequently asked questions')).toBeInTheDocument()
  })

  it('uncovers the pre-hydration shell once it has decided', async () => {
    // index.html hides #root when a session is stored. If this route never
    // cleared the class, the whole app would stay invisible behind it.
    document.documentElement.classList.add('kaydo-restoring')
    Object.assign(auth, { isAuthenticated: false, loading: false })

    renderRoot()

    await waitFor(() => {
      expect(document.documentElement.classList.contains('kaydo-restoring')).toBe(false)
    })
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
