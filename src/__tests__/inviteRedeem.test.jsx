/**
 * Redeeming an invite when the redemption itself fails.
 *
 * The page creates the Firebase account first and redeems second. When the
 * redemption batch failed, the account stayed: the person was signed in, which
 * this page refuses, and their email was taken, so they could neither retry
 * nor sign in to a family. The account is now deleted again.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockCommit = vi.fn()
const mockNavigate = vi.fn()
const mockSetActiveFamilyId = vi.fn()
const mockDeleteUser = vi.fn()

vi.mock('../config/firebase', () => ({ auth: { name: 'test-auth' }, db: { name: 'test-db' } }))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null, firebaseReady: true, setActiveFamilyId: mockSetActiveFamilyId }),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams('family=fam-1&token=tok-1')],
}))

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: vi.fn(async () => ({
    user: { uid: 'uid-new', delete: mockDeleteUser },
  })),
  updateProfile: vi.fn(),
  signOut: vi.fn(async () => {}),
}))

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

async function submitForm() {
  const user = userEvent.setup()
  render(<InviteRedeemPage />)
  // The page lays the form out twice, for mobile and desktop; either will do.
  await user.type((await screen.findAllByPlaceholderText('e.g., Sarah Miller'))[0], 'Sam')
  await user.type(screen.getAllByPlaceholderText('you@example.com')[0], 'new@example.com')
  await user.type(screen.getAllByPlaceholderText('At least 6 characters')[0], 'secret123')
  await user.type(screen.getAllByPlaceholderText('Repeat your password')[0], 'secret123')
  await user.click(screen.getAllByRole('button', { name: /create account|join/i })[0])
}

describe('InviteRedeemPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteUser.mockResolvedValue()
  })

  it('deletes the new account again when the redemption is refused', async () => {
    mockCommit.mockRejectedValue(Object.assign(new Error('denied'), { code: 'permission-denied' }))
    await submitForm()

    await waitFor(() => expect(mockDeleteUser).toHaveBeenCalledTimes(1))
    expect(await screen.findAllByText('This invite link is invalid or has been revoked.')).not.toHaveLength(0)
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockSetActiveFamilyId).not.toHaveBeenCalled()
  })

  it('keeps the account and binds the family when the redemption goes through', async () => {
    mockCommit.mockResolvedValue()
    await submitForm()

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true }))
    expect(mockSetActiveFamilyId).toHaveBeenCalledWith('fam-1')
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })
})
