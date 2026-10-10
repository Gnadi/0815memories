/**
 * An admin who forgot their password used to have no way back into their
 * family, and one who remembered it had no way to change it. These cover the
 * two ways in: the reset email from the login form, and the change in the
 * settings.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const sendPasswordResetEmail = vi.fn(async () => {})
const reauthenticateWithCredential = vi.fn(async () => {})
const updatePassword = vi.fn(async () => {})
const authState = { currentUser: null }

vi.mock('firebase/auth', () => ({
  sendPasswordResetEmail: (...args) => sendPasswordResetEmail(...args),
  EmailAuthProvider: { credential: (email, password) => ({ email, password }) },
  reauthenticateWithCredential: (...args) => reauthenticateWithCredential(...args),
  updatePassword: (...args) => updatePassword(...args),
}))
vi.mock('../config/firebase', () => ({ auth: authState }))

const { default: LoginForm } = await import('../components/auth/LoginForm')
const { requestPasswordReset } = await import('../services/account')

const loginProps = (overrides = {}) => ({
  showAdminLogin: true,
  email: 'anna@example.com', setEmail: () => {},
  password: '', setPassword: () => {},
  showPassword: false, setShowPassword: () => {},
  stayLoggedIn: true, setStayLoggedIn: () => {},
  error: '', loading: false, handleSubmit: (e) => e.preventDefault(),
  allowPasswordReset: true,
  ...overrides,
})

const authError = (code) => Object.assign(new Error(code), { code })

beforeEach(() => {
  vi.clearAllMocks()
  authState.currentUser = null
  authState.languageCode = null
})

describe('Forgot password', () => {
  it('is offered to admins only: guests share the family password', () => {
    const { rerender } = render(<LoginForm {...loginProps()} />)
    expect(screen.getByRole('button', { name: 'Forgot password?' })).toBeInTheDocument()

    rerender(<LoginForm {...loginProps({ showAdminLogin: false })} />)
    expect(screen.queryByRole('button', { name: 'Forgot password?' })).not.toBeInTheDocument()
  })

  it('sends the link to the address from the login form, and says the same either way', async () => {
    const user = userEvent.setup()
    render(<LoginForm {...loginProps()} />)

    await user.click(screen.getByRole('button', { name: 'Forgot password?' }))
    expect(await screen.findByLabelText('Email')).toHaveValue('anna@example.com')
    await user.click(screen.getByRole('button', { name: 'Send link' }))

    expect(sendPasswordResetEmail).toHaveBeenCalledWith(authState, 'anna@example.com', { url: window.location.href })
    expect(await screen.findByRole('status')).toHaveTextContent('If there is an account for anna@example.com')

    // An unknown address must not read any differently.
    await user.click(screen.getByRole('button', { name: 'Back to sign in' }))
    sendPasswordResetEmail.mockRejectedValueOnce(authError('auth/user-not-found'))
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }))
    await user.click(await screen.findByRole('button', { name: 'Send link' }))
    expect(await screen.findByRole('status')).toHaveTextContent('If there is an account for anna@example.com')
  })

  it('says when the address is not one', async () => {
    sendPasswordResetEmail.mockRejectedValueOnce(authError('auth/invalid-email'))
    const user = userEvent.setup()
    render(<LoginForm {...loginProps()} />)
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }))
    await user.click(await screen.findByRole('button', { name: 'Send link' }))
    expect(await screen.findByText('Please enter a valid email address')).toBeInTheDocument()
  })

  it("writes in the reader's language, and sends even when the way back is refused", async () => {
    sendPasswordResetEmail.mockRejectedValueOnce(authError('auth/unauthorized-continue-uri'))
    await requestPasswordReset('anna@example.com', 'de')

    expect(authState.languageCode).toBe('de')
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(2)
    expect(sendPasswordResetEmail.mock.calls[1]).toEqual([authState, 'anna@example.com'])
  })
})

describe('Change password', () => {
  let AccountPanel

  beforeEach(async () => {
    vi.doMock('../context/AuthContext', () => ({
      useAuth: () => ({ user: { email: 'anna@example.com' }, isDemo: false }),
    }))
    vi.resetModules()
    AccountPanel = (await import('../components/admin/AccountPanel')).default
    authState.currentUser = { email: 'anna@example.com' }
  })

  async function fill(user, { current = 'old-password', next = 'new-password', repeat = next } = {}) {
    await user.type(screen.getByLabelText('Current password'), current)
    await user.type(screen.getByLabelText('New password (at least 8 characters)'), next)
    await user.type(screen.getByLabelText('Repeat the new password'), repeat)
    await user.click(screen.getByRole('button', { name: 'Change password' }))
  }

  it('signs in again with the current password before it sets the new one', async () => {
    const user = userEvent.setup()
    render(<AccountPanel />)
    await fill(user)

    expect(reauthenticateWithCredential).toHaveBeenCalledWith(
      authState.currentUser, { email: 'anna@example.com', password: 'old-password' },
    )
    expect(updatePassword).toHaveBeenCalledWith(authState.currentUser, 'new-password')
    expect(await screen.findByRole('status')).toHaveTextContent('Your password has been changed.')
  })

  it('changes nothing when the current password is wrong', async () => {
    reauthenticateWithCredential.mockRejectedValueOnce(authError('auth/invalid-credential'))
    const user = userEvent.setup()
    render(<AccountPanel />)
    await fill(user, { current: 'guess' })

    expect(updatePassword).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent('Your current password is not correct.')
  })

  it('holds new passwords to the minimum, and to matching', async () => {
    const user = userEvent.setup()
    render(<AccountPanel />)
    await fill(user, { next: 'short' })
    expect(screen.getByRole('status')).toHaveTextContent('at least 8 characters')

    await user.clear(screen.getByLabelText('Current password'))
    await user.clear(screen.getByLabelText('New password (at least 8 characters)'))
    await user.clear(screen.getByLabelText('Repeat the new password'))
    await fill(user, { next: 'new-password', repeat: 'new-passwort' })
    expect(screen.getByRole('status')).toHaveTextContent('The new passwords do not match.')
    expect(reauthenticateWithCredential).not.toHaveBeenCalled()
  })
})
