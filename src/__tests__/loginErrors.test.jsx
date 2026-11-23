import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import i18n from '../i18n'

/**
 * What the login page tells someone whose sign-in failed.
 *
 * The family login's messages used to be English sentences shown as they
 * were, on every page in every language. The admin login showed one message
 * for a wrong password and "Could not sign in" for everything else, a throttle
 * and a dropped connection included. And an admin form submitted without an
 * email went to the family login, which asked for a family link.
 */

const loginAsViewer = vi.fn()
const loginAsAdmin = vi.fn()

vi.mock('../config/firebase', () => ({ db: { type: 'test' }, auth: null, functions: null }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false, firebaseReady: true,
    loginAsViewer, loginAsAdmin, sendAdminPasswordReset: vi.fn(),
  }),
}))
vi.mock('../utils/familySlug', () => ({ getSubdomainSlug: () => null }))
vi.mock('../services/family', () => ({
  resolveFamilyBySlug: vi.fn(async () => ({
    id: 'family-1', familyName: 'The Millers', loginPageMode: 'classic',
  })),
  getFamilyPublic: vi.fn(async () => null),
}))

import LoginPage from '../pages/LoginPage'

function renderAt(entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/family/:slug" element={<LoginPage />} />
        <Route path="/home" element={<p>home</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

// The page renders a mobile and a desktop form; both submit the same way and
// both show the error.
async function submit({ email, password = 'a-long-enough-secret' } = {}) {
  const pw = (await screen.findAllByPlaceholderText(i18n.t('auth:login.form.privateKeyPlaceholder')))[0]
  const form = pw.closest('form')
  if (email !== undefined) {
    fireEvent.change(form.querySelector('input[type="email"]'), { target: { value: email } })
  }
  fireEvent.change(pw, { target: { value: password } })
  fireEvent.submit(form)
}

function keyedError(i18nKey) {
  const err = new Error(i18nKey)
  err.i18nKey = i18nKey
  return err
}

const authError = (code) => Object.assign(new Error(`Firebase: (${code})`), { code })

describe('login errors', () => {
  beforeEach(() => {
    window.localStorage.clear()
    loginAsViewer.mockReset()
    loginAsAdmin.mockReset()
  })
  afterEach(() => i18n.changeLanguage('en'))

  it('shows the family login errors in the language of the page', async () => {
    await i18n.changeLanguage('de')
    loginAsViewer.mockRejectedValue(keyedError('login.errors.invalidPassword'))
    renderAt('/family/the-millers')
    await submit()
    expect(await screen.findAllByText('Ungültiger privater Schlüssel')).not.toHaveLength(0)
  })

  it.each([
    ['auth/invalid-credential', 'Invalid email or password'],
    ['auth/wrong-password', 'Invalid email or password'],
    ['auth/user-not-found', 'Invalid email or password'],
    ['auth/too-many-requests', 'Too many attempts — please wait a moment and try again'],
    ['auth/network-request-failed', 'No connection — check your internet and try again'],
    ['auth/invalid-email', 'Please enter a valid email address'],
  ])('explains %s on the admin login', async (code, message) => {
    loginAsAdmin.mockRejectedValue(authError(code))
    renderAt('/login?admin=1')
    await submit({ email: 'admin@example.com' })
    expect(await screen.findAllByText(message)).not.toHaveLength(0)
  })

  it('keeps the generic line for admin errors that could say an account exists', async () => {
    loginAsAdmin.mockRejectedValue(authError('auth/user-disabled'))
    renderAt('/login?admin=1')
    await submit({ email: 'admin@example.com' })
    expect(await screen.findAllByText('Could not sign in')).not.toHaveLength(0)
    expect(screen.queryByText(/disabled/i)).not.toBeInTheDocument()
  })

  it('signs in as an admin with the email trimmed', async () => {
    loginAsAdmin.mockResolvedValue()
    renderAt('/login?admin=1')
    await submit({ email: '  admin@example.com ' })
    expect(await screen.findByText('home')).toBeInTheDocument()
    expect(loginAsAdmin.mock.calls[0][0]).toBe('admin@example.com')
  })

  it('never turns an admin form without an email into a family login', async () => {
    loginAsAdmin.mockRejectedValue(authError('auth/missing-email'))
    renderAt('/login?admin=1')
    await submit({ email: '' })
    expect(await screen.findAllByText('Please enter a valid email address')).not.toHaveLength(0)
    expect(loginAsViewer).not.toHaveBeenCalled()
  })
})
