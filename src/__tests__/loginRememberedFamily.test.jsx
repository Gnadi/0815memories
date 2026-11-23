import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

/**
 * The login page on a device that remembers its family.
 *
 * A family member whose session ran out, or who opened kaydo.app/login, was
 * asked for a link they may no longer have to hand, although this device had
 * signed in to the family before. It now goes straight to that family's
 * login, with a way to forget it for whoever uses the device next.
 */

const loginAsViewer = vi.fn(async () => {})

vi.mock('vite-react-ssg', () => ({ Head: () => null }))
vi.mock('../config/firebase', () => ({ db: { type: 'test' }, auth: null, functions: null }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false, firebaseReady: true,
    loginAsViewer, loginAsAdmin: vi.fn(), sendAdminPasswordReset: vi.fn(),
  }),
}))
vi.mock('../utils/familySlug', () => ({ getSubdomainSlug: () => null }))

const families = vi.hoisted(() => ({
  'fam-millers': { familyName: 'The Millers', loginPageMode: 'classic' },
  'fam-other': { familyName: 'The Others', loginPageMode: 'classic' },
}))
const getFamilyPublic = vi.hoisted(() => vi.fn(async (id) => families[id] || null))
vi.mock('../services/family', () => ({
  resolveFamilyBySlug: vi.fn(async () => null),
  getFamilyPublic,
}))

import LoginPage from '../pages/LoginPage'

function renderAt(entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/home" element={<p>home</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('a device that remembers its family', () => {
  beforeEach(() => {
    window.localStorage.clear()
    loginAsViewer.mockClear()
    getFamilyPublic.mockClear()
    window.localStorage.setItem('kaydo_last_family', 'fam-millers')
  })

  it('opens that family\'s login on a plain /login visit', async () => {
    const { container } = renderAt('/login')
    expect(await screen.findByRole('heading', { name: 'Welcome to The Millers' })).toBeInTheDocument()

    fireEvent.change(container.querySelector('input[type="password"]'), { target: { value: 'family-secret' } })
    fireEvent.submit(container.querySelector('form'))
    await waitFor(() => expect(loginAsViewer).toHaveBeenCalled())
    expect(loginAsViewer.mock.calls[0][1]).toBe('fam-millers')
  })

  it('forgets it on "Not your family?" and asks for a link instead', async () => {
    renderAt('/login')
    fireEvent.click(await screen.findByRole('button', { name: 'Not your family?' }))

    expect(screen.getByText("Open your family's link")).toBeInTheDocument()
    expect(window.localStorage.getItem('kaydo_last_family')).toBeNull()
  })

  it('lets a link to another family win, and offers no forgetting there', async () => {
    renderAt('/login?family=fam-other')
    expect(await screen.findByRole('heading', { name: 'Welcome to The Others' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Not your family?' })).toBeNull()
    expect(window.localStorage.getItem('kaydo_last_family')).toBe('fam-millers')
  })

  it('forgets a family that no longer exists', async () => {
    window.localStorage.setItem('kaydo_last_family', 'fam-deleted')
    renderAt('/login')
    expect(await screen.findByText("Open your family's link")).toBeInTheDocument()
    expect(window.localStorage.getItem('kaydo_last_family')).toBeNull()
  })
})
