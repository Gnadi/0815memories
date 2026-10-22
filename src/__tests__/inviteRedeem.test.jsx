/**
 * Redeeming an invite: the account, the confirmed email address, then the
 * redemption.
 *
 * A password reset goes to the address an account was registered with, so an
 * account whose address nobody confirmed belongs to whoever reads that mailbox.
 * firestore.rules refuses the redemption to such an account (hasVerifiedEmail);
 * the page must not even try, and must lead the person through confirming.
 *
 * An account that belongs to no family yet carries on here where it stopped —
 * which is why a refused redemption no longer deletes it: it is not a dead end.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockCommit = vi.fn()
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

vi.mock('../config/firebase', () => ({ auth: { name: 'test-auth' }, db: { name: 'test-db' } }))

vi.mock('../context/AuthContext', () => ({ useAuth: () => session }))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams('family=fam-1&token=tok-1')],
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
  writeBatch: () => ({ update: vi.fn(), set: vi.fn(), commit: mockCommit }),
  serverTimestamp: vi.fn(),
  arrayUnion: vi.fn(),
}))

const InviteRedeemPage = (await import('../pages/InviteRedeemPage')).default

const NEW_ACCOUNT = { uid: 'uid-new', email: 'New@Example.com ' }

async function fillAndSubmit() {
  const user = userEvent.setup()
  render(<InviteRedeemPage />)
  // The page lays the form out twice, for mobile and desktop; either will do.
  await user.type((await screen.findAllByPlaceholderText('e.g., Sarah Miller'))[0], 'Sam')
  await user.type(screen.getAllByPlaceholderText('you@example.com')[0], 'new@example.com')
  await user.type(screen.getAllByPlaceholderText('At least 6 characters')[0], 'secret123')
  await user.type(screen.getAllByPlaceholderText('Repeat your password')[0], 'secret123')
  await user.click(screen.getAllByRole('button', { name: /join family/i })[0])
}

async function join() {
  const user = userEvent.setup()
  render(<InviteRedeemPage />)
  await user.click((await screen.findAllByRole('button', { name: 'Join The Millers' }))[0])
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
      'new@example.com', 'secret123', 'Sam', undefined, 'en',
    ))
    expect(mockCommit).not.toHaveBeenCalled()
    expect(mockSetActiveFamilyId).not.toHaveBeenCalled()
  })

  it('asks an unconfirmed account to confirm its address, and offers no way to join', async () => {
    setSession({ user: NEW_ACCOUNT, emailVerified: false })
    render(<InviteRedeemPage />)

    expect(await screen.findAllByText('Confirm your email address')).not.toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Join The Millers' })).toBeNull()
    expect(mockCommit).not.toHaveBeenCalled()
  })

  it('joins once the address is confirmed, with a fresh token', async () => {
    setSession({ user: NEW_ACCOUNT, emailVerified: true })
    mockCheckEmailVerified.mockResolvedValue(true)
    mockCommit.mockResolvedValue()
    await join()

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true }))
    expect(mockCheckEmailVerified).toHaveBeenCalled()
    expect(mockCommit).toHaveBeenCalledTimes(1)
    expect(mockSetActiveFamilyId).toHaveBeenCalledWith('fam-1')
  })

  it('does not try to join when Firebase does not confirm the address after all', async () => {
    setSession({ user: NEW_ACCOUNT, emailVerified: true })
    mockCheckEmailVerified.mockResolvedValue(false)
    await join()

    expect(await screen.findAllByText('Your email address is not confirmed yet')).not.toHaveLength(0)
    expect(mockCommit).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('reports a refused redemption and keeps the account', async () => {
    setSession({ user: NEW_ACCOUNT, emailVerified: true })
    mockCheckEmailVerified.mockResolvedValue(true)
    mockCommit.mockRejectedValue(Object.assign(new Error('denied'), { code: 'permission-denied' }))
    await join()

    expect(await screen.findAllByText('This invite link is invalid or has been revoked.')).not.toHaveLength(0)
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockSetActiveFamilyId).not.toHaveBeenCalled()
  })

  it('asks a member of another family to sign out first', async () => {
    setSession({ user: { uid: 'uid-admin', email: 'admin@example.com' }, familyId: 'fam-other', emailVerified: true })
    render(<InviteRedeemPage />)

    expect(await screen.findAllByText(/You're already signed in/)).not.toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Join The Millers' })).toBeNull()
    for (const button of screen.getAllByRole('button', { name: /join family/i })) {
      expect(button).toBeDisabled()
    }
  })
})
