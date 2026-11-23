import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * The signup page's frame and first step.
 *
 * It rendered a phone and a desktop layout side by side, so every field
 * existed twice and its labels were tied to none of them; and "Sign in" went
 * to the landing page.
 */

vi.mock('vite-react-ssg', () => ({ Head: () => null }))
vi.mock('../config/firebase', () => ({ db: null, auth: null, functions: null }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    signup: vi.fn(), createOwnFamily: vi.fn(), user: null, isAuthenticated: false,
    isViewer: false, familyId: null, emailVerified: false, loading: false, firebaseReady: true,
  }),
}))

import SignupPage from '../pages/SignupPage'

const renderPage = () => render(<MemoryRouter initialEntries={['/signup']}><SignupPage /></MemoryRouter>)

describe('the signup page', () => {
  it('renders one form and one heading', () => {
    const { container } = renderPage()
    expect(container.querySelectorAll('form')).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('ties labels to fields and tells password managers it is a new account', () => {
    renderPage()
    expect(screen.getByLabelText('Your Name')).toHaveAttribute('autocomplete', 'name')
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password')
  })

  it('sends someone who has an account to the admin login', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?admin=1')
  })

  it('shows the login page\'s picture, once', () => {
    const { container } = renderPage()
    const images = [...container.querySelectorAll('img')].filter((img) => img.src.includes('/login-art/'))
    expect(images).toHaveLength(1)
  })
})
