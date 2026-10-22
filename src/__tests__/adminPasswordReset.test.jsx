/**
 * "Forgot password" for admins.
 *
 * Firebase sends the reset mail and sets the new password on its own page; what
 * Kaydo owns is the request, and the request must not tell a stranger whether
 * an address has an account. Where the project's email enumeration protection
 * is off, Firebase answers an unknown address with auth/user-not-found — that
 * has to read exactly like a sent mail.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'

const sendReset = vi.fn()
const authInstance = { name: 'test-auth', languageCode: null }

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    cb(null)
    return () => {}
  },
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithCustomToken: vi.fn(),
  sendPasswordResetEmail: (...args) => sendReset(...args),
  updateProfile: vi.fn(),
  signOut: vi.fn(async () => {}),
  setPersistence: vi.fn(() => Promise.resolve()),
  browserLocalPersistence: 'local',
  browserSessionPersistence: 'session',
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  addDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(async () => ({ empty: true, docs: [] })),
  serverTimestamp: vi.fn(),
  updateDoc: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
}))

vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn() }))

vi.mock('../config/firebase', () => ({
  auth: authInstance,
  db: { name: 'test-db' },
  functions: { name: 'test-functions' },
}))

vi.mock('../utils/encryption', () => ({
  generateEncryptionKey: vi.fn(),
  importEncryptionKey: vi.fn(),
  clearDecryptedTextCache: vi.fn(),
}))
vi.mock('../components/media/useDecryptedMedia', () => ({ clearDecryptedMediaCache: vi.fn() }))
vi.mock('../utils/decryptPool', () => ({ terminateDecryptPool: vi.fn() }))

const { AuthProvider } = await import('../context/AuthContext')
const { default: LoginForm } = await import('../components/auth/LoginForm')

function authError(code) {
  const err = new Error(code)
  err.code = code
  return err
}

function Form({ showAdminLogin = true, resetOpen = false, setResetOpen = vi.fn() }) {
  return (
    <AuthProvider>
      <LoginForm
        showAdminLogin={showAdminLogin}
        email="admin@example.com"
        setEmail={vi.fn()}
        password=""
        setPassword={vi.fn()}
        showPassword={false}
        setShowPassword={vi.fn()}
        stayLoggedIn
        setStayLoggedIn={vi.fn()}
        error=""
        loading={false}
        handleSubmit={vi.fn()}
        resetOpen={resetOpen}
        setResetOpen={setResetOpen}
      />
    </AuthProvider>
  )
}

/** Submits the reset form and returns what the person is shown. */
async function requestReset() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
  })
  const status = screen.queryByRole('status')
  return status ? status.textContent : screen.getByText(/.+/, { selector: 'p.text-red-600' }).textContent
}

describe('admin password reset', () => {
  beforeEach(() => {
    sendReset.mockReset()
    authInstance.languageCode = null
  })

  afterEach(cleanup)

  it('is offered on the admin login only', () => {
    const { unmount } = render(<Form showAdminLogin={false} />)
    expect(screen.queryByRole('button', { name: 'Forgot password?' })).toBeNull()
    unmount()

    const setResetOpen = vi.fn()
    render(<Form setResetOpen={setResetOpen} />)
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
    expect(setResetOpen).toHaveBeenCalledWith(true)
  })

  it('sends the mail for the address typed, in the interface language', async () => {
    sendReset.mockResolvedValue(undefined)
    render(<Form resetOpen />)

    // Taken over from the login form, and trimmed before it is sent.
    const input = screen.getByLabelText('Email')
    expect(input).toHaveValue('admin@example.com')
    fireEvent.change(input, { target: { value: '  admin@example.com ' } })

    const shown = await requestReset()

    expect(sendReset).toHaveBeenCalledTimes(1)
    expect(sendReset).toHaveBeenCalledWith(authInstance, 'admin@example.com')
    expect(authInstance.languageCode).toBe('en')
    expect(shown).toContain("If admin@example.com belongs to a Kaydo admin account, we've sent a link")
  })

  it('answers an unknown address exactly like a known one', async () => {
    sendReset.mockResolvedValue(undefined)
    render(<Form resetOpen />)
    const known = await requestReset()
    cleanup()

    sendReset.mockRejectedValue(authError('auth/user-not-found'))
    render(<Form resetOpen />)
    const unknown = await requestReset()

    expect(unknown).toBe(known)
  })

  it('reports errors that say nothing about the account', async () => {
    sendReset.mockRejectedValue(authError('auth/too-many-requests'))
    render(<Form resetOpen />)
    expect(await requestReset()).toBe('Too many attempts — please wait a moment and try again')
    expect(screen.queryByRole('status')).toBeNull()
    cleanup()

    sendReset.mockRejectedValue(authError('auth/invalid-email'))
    render(<Form resetOpen />)
    expect(await requestReset()).toBe('Please enter a valid email address')
  })

  it('shows anything else as the generic line, never the raw Firebase error', async () => {
    sendReset.mockRejectedValue(authError('auth/internal-error'))
    render(<Form resetOpen />)
    const shown = await requestReset()
    expect(shown).toBe('Could not send the email. Please try again.')
    expect(shown).not.toContain('auth/')
  })

  it('goes back to the login form', () => {
    const setResetOpen = vi.fn()
    render(<Form resetOpen setResetOpen={setResetOpen} />)
    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }))
    expect(setResetOpen).toHaveBeenCalledWith(false)
  })
})
