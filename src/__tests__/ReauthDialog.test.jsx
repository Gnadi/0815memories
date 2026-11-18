/* The password prompt before what cannot be undone: removing an admin,
   deleting the family and deleting one's own account. Firebase checks the
   password (AuthProviderImpl); these check that each action waits for it. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const auth = vi.hoisted(() => ({
  user: { uid: 'admin-2' }, isAdmin: true, isDemo: false, familyId: 'fam1',
  reauthenticate: vi.fn(), logout: vi.fn(),
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../config/firebase', () => ({ db: {}, functions: {} }))

const family = vi.hoisted(() => ({ current: null }))
vi.mock('../services/family', () => ({
  subscribeFamily: (_id, onData) => {
    onData(family.current)
    return () => {}
  },
  getFamily: async () => family.current,
}))

const calls = vi.hoisted(() => ({ deleteAccount: vi.fn(), request: vi.fn(), removeAdmin: vi.fn() }))
vi.mock('../services/admins', () => ({
  deleteMyAccount: (...a) => calls.deleteAccount(...a),
  removeAdmin: (...a) => calls.removeAdmin(...a),
  createInvite: vi.fn(),
  revokeInvite: vi.fn(),
  subscribeAdmins: (_id, onData) => {
    onData([{ uid: 'owner-1', email: 'owner@example.test' }, { uid: 'admin-2', email: 'me@example.test' }, { uid: 'admin-3', email: 'third@example.test' }])
    return () => {}
  },
  subscribeOpenInvites: () => () => {},
}))
vi.mock('../services/familyDeletion', async (original) => ({
  ...(await original()),
  requestFamilyDeletion: (...a) => calls.request(...a),
  cancelFamilyDeletion: vi.fn(),
}))

import ReauthDialog from '../components/admin/ReauthDialog'
import DeleteAccountPanel from '../components/admin/DeleteAccountPanel'
import DeleteFamilyPanel from '../components/admin/DeleteFamilyPanel'
import ManageAdminsPanel from '../components/admin/ManageAdminsPanel'

const base = { adminUid: 'owner-1', adminUids: ['owner-1', 'admin-2', 'admin-3'], familyName: 'Hartmann' }
const type = (password) => fireEvent.change(screen.getByLabelText('Your password'), { target: { value: password } })

beforeEach(() => {
  cleanup()
  Object.assign(auth, { user: { uid: 'admin-2' }, isAdmin: true, isDemo: false })
  auth.reauthenticate.mockReset().mockResolvedValue(undefined)
  auth.logout.mockReset().mockResolvedValue(undefined)
  calls.deleteAccount.mockReset().mockResolvedValue({ ok: true })
  calls.request.mockReset().mockResolvedValue({})
  calls.removeAdmin.mockReset().mockResolvedValue(undefined)
  family.current = base
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('ReauthDialog', () => {
  it('continues only once the password was accepted', async () => {
    const onConfirmed = vi.fn()
    render(<ReauthDialog onConfirmed={onConfirmed} onCancel={() => {}} />)
    const button = screen.getByRole('button', { name: 'Continue' })
    expect(button).toBeDisabled()

    type('secret-pw')
    fireEvent.click(button)
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1))
    expect(auth.reauthenticate).toHaveBeenCalledWith('secret-pw')
  })

  it('says so for a wrong password and does not continue', async () => {
    auth.reauthenticate.mockRejectedValue({ code: 'auth/invalid-credential' })
    const onConfirmed = vi.fn()
    render(<ReauthDialog onConfirmed={onConfirmed} onCancel={() => {}} />)
    type('nope')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That password is not correct.')
    expect(onConfirmed).not.toHaveBeenCalled()
  })

  it('tells the throttle apart from a wrong password', async () => {
    auth.reauthenticate.mockRejectedValue({ code: 'auth/too-many-requests' })
    render(<ReauthDialog onConfirmed={() => {}} onCancel={() => {}} />)
    type('x')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts')
  })
})

describe('DeleteAccountPanel', () => {
  const renderPanel = () => render(<MemoryRouter><DeleteAccountPanel /></MemoryRouter>)

  it('asks for the password before the account goes, then signs out', async () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
    expect(calls.deleteAccount).not.toHaveBeenCalled()

    type('secret-pw')
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete my account' }).at(-1))
    await waitFor(() => expect(calls.deleteAccount).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(auth.logout).toHaveBeenCalledTimes(1))
    expect(auth.reauthenticate).toHaveBeenCalledWith('secret-pw')
  })

  it('does nothing when the confirmation is declined or the password is wrong', async () => {
    window.confirm.mockReturnValue(false)
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
    expect(screen.queryByLabelText('Your password')).toBeNull()

    window.confirm.mockReturnValue(true)
    auth.reauthenticate.mockRejectedValue({ code: 'auth/wrong-password' })
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
    type('nope')
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete my account' }).at(-1))
    await screen.findByRole('alert')
    expect(calls.deleteAccount).not.toHaveBeenCalled()
    expect(auth.logout).not.toHaveBeenCalled()
  })

  it('tells the owner the account goes with the family, and offers no button', () => {
    auth.user = { uid: 'owner-1' }
    renderPanel()
    expect(screen.getByText(/deleted together with it/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('says it needs a server in the demo, and asks nothing', () => {
    auth.isDemo = true
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
    expect(screen.getByRole('status')).toHaveTextContent('Not in the demo')
    expect(screen.queryByLabelText('Your password')).toBeNull()
  })

  it('shows nothing to a viewer', () => {
    Object.assign(auth, { user: { uid: 'viewer:fam1' }, isAdmin: false })
    const { container } = renderPanel()
    expect(container).toBeEmptyDOMElement()
  })

  it('asks for the password again when the server says the sign-in is too old', async () => {
    calls.deleteAccount.mockRejectedValue({ code: 'functions/failed-precondition', message: 'Confirm your password again' })
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
    type('secret-pw')
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete my account' }).at(-1))
    expect(await screen.findByText(/confirm your password again and retry/)).toBeInTheDocument()
    expect(auth.logout).not.toHaveBeenCalled()
  })

  it('keeps the session when the server refuses', async () => {
    calls.deleteAccount.mockRejectedValue({ code: 'functions/failed-precondition' })
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
    type('secret-pw')
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete my account' }).at(-1))
    expect(await screen.findByText(/own a family/)).toBeInTheDocument()
    expect(auth.logout).not.toHaveBeenCalled()
  })
})

describe('the other sensitive actions', () => {
  it('asks the owner for the password before the family is scheduled for deletion', async () => {
    auth.user = { uid: 'owner-1' }
    render(<DeleteFamilyPanel />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hartmann' } })
    fireEvent.click(screen.getByRole('button', { name: /Delete in 14 days/ }))
    expect(calls.request).not.toHaveBeenCalled()

    type('secret-pw')
    fireEvent.click(screen.getAllByRole('button', { name: /Delete in 14 days/ }).at(-1))
    await waitFor(() => expect(calls.request).toHaveBeenCalledWith('fam1'))
  })

  it('asks for the password before an admin is removed', async () => {
    render(<ManageAdminsPanel />)
    const [first] = await screen.findAllByRole('button', { name: 'Remove' })
    fireEvent.click(first)
    expect(calls.removeAdmin).not.toHaveBeenCalled()

    type('secret-pw')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(calls.removeAdmin).toHaveBeenCalledTimes(1))
  })

  it('does not remove the admin when the password is wrong', async () => {
    auth.reauthenticate.mockRejectedValue({ code: 'auth/wrong-password' })
    render(<ManageAdminsPanel />)
    const [first] = await screen.findAllByRole('button', { name: 'Remove' })
    fireEvent.click(first)
    type('nope')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('alert')
    expect(calls.removeAdmin).not.toHaveBeenCalled()
  })
})
