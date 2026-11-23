/**
 * Redeeming an invite: the account, the confirmed email address, then the
 * redemption.
 *
 * A password reset goes to the address an account was registered with, so an
 * account whose address nobody confirmed belongs to whoever reads that mailbox.
 * The redeemFamilyInvite function refuses the redemption to such an account;
 * the page must not even try, and must lead the person through confirming.
 *
 * An account that belongs to no family yet carries on here where it stopped —
 * which is why a refused redemption no longer deletes it: it is not a dead end.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockRedeem = vi.fn()
const mockNavigate = vi.fn()
const mockSetActiveFamilyId = vi.fn()
const mockSignup = vi.fn()
const mockCheckEmailVerified = vi.fn()

const session = {}
function setSession({ user = null, familyId = null, isViewer = false, emailVerified = false } = {}) {
  Object.assign(session, {
    user,
    familyId,
    isViewer,
    emailVerified,
    firebaseReady: true,
    signup: mockSignup,
    checkEmailVerified: mockCheckEmailVerified,
    sendVerificationEmail: vi.fn(),
    discardNewAccount: vi.fn(),
    logout: vi.fn(),
    setActiveFamilyId: mockSetActiveFamilyId,
  })
}

vi.mock('../config/firebase', () => ({ auth: { name: 'test-auth' }, db: { name: 'test-db' }, functions: { name: 'test-functions' } }))

// The redemption itself is the redeemFamilyInvite function's.
vi.mock('firebase/functions', () => ({ httpsCallable: (_functions, name) => (data) => mockRedeem(name, data) }))

vi.mock('../context/AuthContext', () => ({ useAuth: () => session }))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams('family=fam-1&token=tok-1')],
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}))

vi.mock('firebase/auth', () => ({ signOut: vi.fn(async () => {}) }))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, ...path) => path.join('/')),
  getDoc: vi.fn(async (path) => ({
    exists: () => true,
    data: () =>
      path.startsWith('familyPublic/')
        ? { familyName: 'The Millers' }
        : { used: false, expiresAt: { toMillis: () => Date.now() + 86_400_000 } },
  })),
  serverTimestamp: vi.fn(),
  arrayUnion: vi.fn(),
}))

const InviteRedeemPage = (await import('../pages/InviteRedeemPage')).default

const NEW_ACCOUNT = { uid: 'uid-new', email: 'New@Example.com ' }

async function fillAndSubmit() {
  const user = userEvent.setup()
  render(<InviteRedeemPage />)
  // One form for every screen size: each field exists once.
  await user.type(await screen.findByLabelText('Your Name'), 'Sam')
  await user.type(screen.getByLabelText('Email'), 'new@example.com')
  await user.type(screen.getByLabelText('Password'), 'secret-pass-123')
  await user.click(screen.getByRole('button', { name: /join family/i }))
}

async function join() {
  const user = userEvent.setup()
  render(<InviteRedeemPage />)
  await user.click(await screen.findByRole('button', { name: 'Join The Millers' }))
}

describe('InviteRedeemPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSession()
    mockSignup.mockResolvedValue()
  })

  it('creates the account and sends the confirmation mail, but redeems nothing yet', async () => {
    await fillAndSubmit()

    await waitFor(() => expect(mockSignup).toHaveBeenCalledWith(
      'new@example.com', 'secret-pass-123', 'Sam', undefined, 'en',
    ))
    expect(mockRedeem).not.toHaveBeenCalled()
    expect(mockSetActiveFamilyId).not.toHaveBeenCalled()
  })

  it('asks an unconfirmed account to confirm its address, and offers no way to join', async () => {
    setSession({ user: NEW_ACCOUNT, emailVerified: false })
    render(<InviteRedeemPage />)

    expect(await screen.findByText('Confirm your email address')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Join The Millers' })).toBeNull()
    expect(mockRedeem).not.toHaveBeenCalled()
  })

  it('joins once the address is confirmed, with a fresh token', async () => {
    setSession({ user: NEW_ACCOUNT, emailVerified: true })
    mockCheckEmailVerified.mockResolvedValue(true)
    mockRedeem.mockResolvedValue({ data: { ok: true } })
    await join()

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true }))
    expect(mockCheckEmailVerified).toHaveBeenCalled()
    expect(mockRedeem).toHaveBeenCalledTimes(1)
    expect(mockRedeem).toHaveBeenCalledWith('redeemFamilyInvite', { familyId: 'fam-1', token: 'tok-1' })
    expect(mockSetActiveFamilyId).toHaveBeenCalledWith('fam-1')
  })

  it('does not try to join when Firebase does not confirm the address after all', async () => {
    setSession({ user: NEW_ACCOUNT, emailVerified: true })
    mockCheckEmailVerified.mockResolvedValue(false)
    await join()

    expect(await screen.findByText('Your email address is not confirmed yet')).toBeInTheDocument()
    expect(mockRedeem).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('reports a refused redemption and keeps the account', async () => {
    setSession({ user: NEW_ACCOUNT, emailVerified: true })
    mockCheckEmailVerified.mockResolvedValue(true)
    mockRedeem.mockRejectedValue(Object.assign(new Error('spent'), { code: 'functions/failed-precondition' }))
    await join()

    expect(await screen.findByText('This invite link is invalid or has been revoked.')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockSetActiveFamilyId).not.toHaveBeenCalled()
  })

  it('asks a member of another family to sign out first', async () => {
    setSession({ user: { uid: 'uid-admin', email: 'admin@example.com' }, familyId: 'fam-other', emailVerified: true })
    render(<InviteRedeemPage />)

    expect(await screen.findByText(/You're already signed in/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Join The Millers' })).toBeNull()
    expect(screen.getByRole('button', { name: /join family/i })).toBeDisabled()
  })

  it('speaks the language of the page, form and notice included', async () => {
    const i18n = (await import('../i18n')).default
    await i18n.changeLanguage('de')
    try {
      setSession()
      render(<InviteRedeemPage />)
      // The form was English whatever the language, although translated.
      expect(await screen.findByLabelText('Dein Name')).toHaveAttribute('autocomplete', 'name')
      expect(screen.getByRole('button', { name: /Familie beitreten/ })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1, name: 'Tritt The Millers bei' })).toBeInTheDocument()
    } finally {
      await i18n.changeLanguage('en')
    }
  })
})
