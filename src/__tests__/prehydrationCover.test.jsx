/* Every URL is served the pre-rendered "/" landing page, so a reload of /home
   used to paint the marketing page before the app had rendered. index.html now
   covers #root on every path but "/" (.kaydo-restoring); these tests pin when
   the layout lifts that cover — only once the real page has committed, never
   while a lazy page is still loading. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { lazy } from 'react'
import { act, render, screen, cleanup, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'

vi.mock('../config/firebase', () => ({ db: null, auth: null, getMessagingInstance: () => Promise.resolve(null) }))
vi.mock('vite-react-ssg', () => ({ Head: () => null }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, loading: false }),
  AuthProvider: ({ children }) => children,
}))

import { routes } from '../App'

const covered = () => document.documentElement.classList.contains('kaydo-restoring')

function renderAt(path, children) {
  const router = createMemoryRouter([{ ...routes[0], children }], { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

beforeEach(() => {
  document.documentElement.classList.add('kaydo-restoring')
})

afterEach(() => {
  cleanup()
  document.documentElement.classList.remove('kaydo-restoring')
})

describe('the pre-hydration cover on paths other than "/"', () => {
  it('stays up while the page is still loading and lifts once it has rendered', async () => {
    let resolvePage
    const SlowPage = lazy(() => new Promise((resolve) => { resolvePage = resolve }))

    renderAt('/slow', [{ path: 'slow', element: <SlowPage /> }])

    // Give the lazy import a chance to start; the page has not rendered yet.
    await act(async () => {})
    expect(covered()).toBe(true)

    await act(async () => resolvePage({ default: () => <div>the real page</div> }))

    expect(await screen.findByText('the real page')).toBeInTheDocument()
    await waitFor(() => expect(covered()).toBe(false))
  })

  it('lifts for a route error too, so the error screen is not hidden', async () => {
    const Broken = () => { throw new Error('boom') }
    vi.spyOn(console, 'error').mockImplementation(() => {})

    renderAt('/broken', [{ path: 'broken', element: <Broken /> }])

    await waitFor(() => expect(covered()).toBe(false))
  })
})
