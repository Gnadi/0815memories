/**
 * The admin's own account in the settings: changing the password, and leaving
 * for good. A co-admin deletes their account and leaves; the owner deletes the
 * whole family, which the deleteFamily function carries out. Either confirms
 * the password first — not something to happen from a device someone left
 * unlocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const reauthenticateWithCredential = vi.fn(async () => {})
const updatePassword = vi.fn(async () => {})
const deleteUser = vi.fn(async () => {})
const callable = vi.fn(async () => ({ data: { ok: true } }))
const removeAdmin = vi.fn(async () => {})
const openInvitesBy = vi.fn(async () => ['invite-1'])
const removeFCMToken = vi.fn(async () => {})
const logout = vi.fn(async () => {})
const navigate = vi.fn()
const steps = []

const authState = { currentUser: null }
let family
let session

vi.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: (email, password) => ({ email, password }) },
  reauthenticateWithCredential: (...args) => reauthenticateWithCredential(...args),
  updatePassword: (...args) => updatePassword(...args),
  deleteUser: (...args) => deleteUser(...args),
}))
vi.mock('firebase/functions', () => ({ httpsCallable: (_functions, name) => (data) => callable(name, data) }))
vi.mock('../config/firebase', () => ({ auth: authState, functions: {} }))
vi.mock('../utils/notifications', () => ({ removeFCMToken: () => removeFCMToken() }))
vi.mock('../services/admins', () => ({
  removeAdmin: (...args) => removeAdmin(...args),
  openInvitesBy: (...args) => openInvitesBy(...args),
}))
vi.mock('../services/family', () => ({ getFamily: async () => family }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => session }))
vi.mock('react-router-dom', async (original) => ({ ...(await original()), useNavigate: () => navigate }))

const { default: AccountPanel } = await import('../components/admin/AccountPanel')

const authError = (code) => Object.assign(new Error(code), { code })
const show = () => render(<MemoryRouter><AccountPanel /></MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  steps.length = 0
  authState.currentUser = { uid: 'uid-anna', email: 'anna@example.com' }
  family = { adminUid: 'uid-owner', familyName: 'The Millers' }
  session = { user: authState.currentUser, isDemo: false, familyId: 'family-1', logout }
  for (const [name, fn] of [['fcm', removeFCMToken], ['leave', removeAdmin], ['delete', deleteUser], ['logout', logout]]) {
    fn.mockImplementation(async () => { steps.push(name) })
  }
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('Change password', () => {
  async function fill(user, { current = 'old-password', next = 'new-password', repeat = next } = {}) {
    await user.type(screen.getByLabelText('Current password'), current)
    await user.type(screen.getByLabelText('New password (at least 8 characters)'), next)
    await user.type(screen.getByLabelText('Repeat the new password'), repeat)
    await user.click(screen.getByRole('button', { name: 'Change password' }))
  }

  it('signs in again with the current password before it sets the new one', async () => {
    const user = userEvent.setup()
    show()
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
    show()
    await fill(user, { current: 'guess' })

    expect(updatePassword).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent('Your current password is not correct.')
  })

  it('holds new passwords to the minimum, and to matching', async () => {
    const user = userEvent.setup()
    show()
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

describe('Delete your account', () => {
  it('leaves the family, with the invites made, then deletes the account', async () => {
    const user = userEvent.setup()
    show()
    await user.type(await screen.findByLabelText('Your password, to confirm'), 'my-password')
    await user.click(screen.getByRole('button', { name: 'Delete my account' }))

    expect(reauthenticateWithCredential).toHaveBeenCalledWith(
      authState.currentUser, { email: 'anna@example.com', password: 'my-password' },
    )
    expect(removeAdmin).toHaveBeenCalledWith('family-1', 'uid-anna', ['invite-1'])
    expect(deleteUser).toHaveBeenCalledWith(authState.currentUser)
    // Each step needs the one before still standing.
    expect(steps).toEqual(['fcm', 'leave', 'delete', 'logout'])
    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('does nothing without the right password', async () => {
    reauthenticateWithCredential.mockRejectedValueOnce(authError('auth/invalid-credential'))
    const user = userEvent.setup()
    show()
    await user.type(await screen.findByLabelText('Your password, to confirm'), 'guess')
    await user.click(screen.getByRole('button', { name: 'Delete my account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That password is not correct.')
    expect(steps).toEqual([])
  })

  it('is not offered to the owner, whose family it is', async () => {
    family = { adminUid: 'uid-anna', familyName: 'The Millers' }
    show()
    expect(await screen.findByRole('button', { name: 'Delete the family for good' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete my account' })).not.toBeInTheDocument()
  })
})

describe('Delete the family', () => {
  beforeEach(() => {
    family = { adminUid: 'uid-anna', familyName: 'The Millers' }
  })

  it("waits for the family's name, then has the server delete it", async () => {
    const user = userEvent.setup()
    show()
    const submit = await screen.findByRole('button', { name: 'Delete the family for good' })
    await user.type(screen.getByLabelText('Your password, to confirm'), 'my-password')
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText("Type the family's name, The Millers, to confirm."), 'The Millers')
    await user.click(submit)

    expect(reauthenticateWithCredential).toHaveBeenCalled()
    expect(callable).toHaveBeenCalledWith('deleteFamily', { familyId: 'family-1' })
    expect(removeAdmin).not.toHaveBeenCalled()
    expect(logout).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('says so in the demo, which has no family to delete', async () => {
    session = { ...session, isDemo: true }
    const user = userEvent.setup()
    show()
    await user.type(await screen.findByLabelText('Your password, to confirm'), 'x')
    await user.type(screen.getByLabelText("Type the family's name, The Millers, to confirm."), 'The Millers')
    await user.click(screen.getByRole('button', { name: 'Delete the family for good' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(callable).not.toHaveBeenCalled()
  })
})
