/* Deleting the family, in the settings and on the home page. The server
   decides who may (functions/familyDeletion.js); these check that the app
   offers it to the owner alone, asks for the family's name first, and tells
   everyone else once a date is set. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const auth = { user: { uid: 'owner-1' }, isAdmin: true, isDemo: false, familyId: 'fam1' }
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../config/firebase', () => ({ db: {}, functions: {} }))

const family = vi.hoisted(() => ({ current: null }))
vi.mock('../services/family', () => ({
  subscribeFamily: (_id, onData) => {
    onData(family.current)
    return () => {}
  },
}))

const calls = vi.hoisted(() => ({ request: vi.fn(), cancel: vi.fn() }))
vi.mock('../services/familyDeletion', async (original) => ({
  ...(await original()),
  requestFamilyDeletion: (...a) => calls.request(...a),
  cancelFamilyDeletion: (...a) => calls.cancel(...a),
}))

import DeleteFamilyPanel from '../components/admin/DeleteFamilyPanel'
import FamilyDeletionBanner from '../components/home/FamilyDeletionBanner'

const ON = new Date(2026, 10, 23)
const base = { adminUid: 'owner-1', familyName: 'Hartmann' }
const scheduled = { ...base, deletion: { deleteAfter: { toDate: () => ON } } }

beforeEach(() => {
  cleanup()
  calls.request.mockReset().mockResolvedValue({ deleteAfter: ON.toISOString() })
  calls.cancel.mockReset().mockResolvedValue({ ok: true })
  Object.assign(auth, { user: { uid: 'owner-1' }, isAdmin: true, isDemo: false })
  family.current = base
})

describe('DeleteFamilyPanel', () => {
  it('asks the owner for the family\'s name before it schedules anything', async () => {
    render(<DeleteFamilyPanel />)
    const button = screen.getByRole('button', { name: /Delete in 14 days/ })
    expect(button).toBeDisabled()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hartman' } })
    expect(button).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' hartmann ' } })
    expect(button).toBeEnabled()

    fireEvent.click(button)
    await waitFor(() => expect(calls.request).toHaveBeenCalledWith('fam1'))
  })

  it('shows another admin nothing while no deletion is scheduled', () => {
    auth.user = { uid: 'admin-2' }
    const { container } = render(<DeleteFamilyPanel />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the date, and lets the owner take it back', async () => {
    family.current = scheduled
    render(<DeleteFamilyPanel />)
    expect(screen.getByText(/will be deleted on November 23, 2026/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Keep the family' }))
    await waitFor(() => expect(calls.cancel).toHaveBeenCalledWith('fam1'))
    expect(await screen.findByText('The family stays. Nothing was deleted.')).toBeInTheDocument()
  })

  it('shows another admin the date, without a way to take it back', () => {
    family.current = scheduled
    auth.user = { uid: 'admin-2' }
    render(<DeleteFamilyPanel />)
    expect(screen.getByText(/will be deleted on November 23, 2026/)).toBeInTheDocument()
    expect(screen.getByText(/Only the owner can take it back/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('says so when the server refuses', async () => {
    calls.request.mockRejectedValue(Object.assign(new Error('no'), { code: 'functions/permission-denied' }))
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<DeleteFamilyPanel />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hartmann' } })
    fireEvent.click(screen.getByRole('button', { name: /Delete in 14 days/ }))
    expect(await screen.findByText("Only the family's owner can do this.")).toBeInTheDocument()
    quiet.mockRestore()
  })

  it('schedules nothing in the demo', async () => {
    auth.isDemo = true
    render(<DeleteFamilyPanel />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hartmann' } })
    fireEvent.click(screen.getByRole('button', { name: /Delete in 14 days/ }))
    expect(await screen.findByText(/Not in the demo/)).toBeInTheDocument()
    expect(calls.request).not.toHaveBeenCalled()
  })
})

describe('FamilyDeletionBanner', () => {
  const renderBanner = () => render(<MemoryRouter><FamilyDeletionBanner /></MemoryRouter>)

  it('stays away while nothing is scheduled', () => {
    const { container } = renderBanner()
    expect(container).toBeEmptyDOMElement()
  })

  it('tells a co-admin, with the way to the backup', () => {
    family.current = scheduled
    auth.user = { uid: 'admin-2' }
    renderBanner()
    expect(screen.getByText(/will be deleted on November 23, 2026/)).toBeInTheDocument()
    expect(screen.getByText(/Download a backup in the settings/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open the settings' })).toHaveAttribute('href', '/settings')
  })

  it('tells a viewer, without sending them to settings they do not have', () => {
    family.current = scheduled
    Object.assign(auth, { user: { uid: 'viewer:fam1' }, isAdmin: false })
    renderBanner()
    expect(screen.getByText(/will be gone after that day/)).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })
})
