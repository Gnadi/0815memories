import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import RouteErrorScreen from '../components/RouteErrorScreen'

// Renders a router whose target route fails the way a stale tab does after a
// deploy: the loader (or a lazy chunk) rejects, and the error bubbles to the
// root errorElement.
function renderWithFailingRoute(error) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        errorElement: <RouteErrorScreen />,
        children: [
          { index: true, element: <div>home</div> },
          {
            path: 'boom',
            loader: () => {
              throw error
            },
            element: <div>never</div>,
          },
        ],
      },
    ],
    { initialEntries: ['/boom'] }
  )
  return render(<RouterProvider router={router} />)
}

const staleDeployError = new SyntaxError(
  `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`
)

describe('RouteErrorScreen', () => {
  let reloadSpy

  beforeEach(() => {
    sessionStorage.clear()
    reloadSpy = vi.fn()
    // jsdom's location.reload is not configurable; replace the whole object.
    const loc = window.location
    delete window.location
    window.location = { ...loc, reload: reloadSpy }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('auto-reloads once for stale-deploy errors (JSON parse of HTML)', async () => {
    renderWithFailingRoute(staleDeployError)
    await waitFor(() => expect(reloadSpy).toHaveBeenCalledTimes(1))
    // While reloading it shows the updating note, not the raw error
    expect(screen.getByText(/updating to the latest version/i)).toBeInTheDocument()
    expect(screen.queryByText(/unexpected token/i)).not.toBeInTheDocument()
  })

  it('auto-reloads for failed dynamic chunk imports', async () => {
    renderWithFailingRoute(
      new TypeError('Failed to fetch dynamically imported module: https://x/assets/HomePage-abc.js')
    )
    await waitFor(() => expect(reloadSpy).toHaveBeenCalledTimes(1))
  })

  it('does not reload again within the guard window — shows the fallback UI instead', async () => {
    sessionStorage.setItem('kaydo:stale-reload-at', String(Date.now()))
    renderWithFailingRoute(staleDeployError)
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument()
    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('shows the fallback UI (no auto-reload) for unrelated errors', async () => {
    renderWithFailingRoute(new Error('kaboom'))
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument()
    expect(reloadSpy).not.toHaveBeenCalled()
    // Never exposes the raw stack/message to the user
    expect(screen.queryByText(/kaboom/)).not.toBeInTheDocument()
  })
})
