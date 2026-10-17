/* Viewers get a settings page of their own: language, text size and whether
   this device gets notifications. The family's settings below them read and
   write the family document, which firestore.rules keeps to admins, so a
   viewer must not be shown them. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const auth = { isAdmin: false, familyId: 'fam1', isDemo: false }
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../components/layout/Sidebar', () => ({ default: () => null }))
vi.mock('../components/layout/MobileHeader', () => ({ default: () => null }))
vi.mock('../components/admin/SettingsPanel', () => ({ default: () => <div>family settings</div> }))

const push = vi.hoisted(() => ({
  supported: true,
  optedOut: false,
  enablePush: vi.fn(),
  disablePush: vi.fn(),
}))
vi.mock('../utils/notifications', () => ({
  isPushSupported: () => push.supported,
  isPushOptedOut: () => push.optedOut,
  enablePush: (...a) => push.enablePush(...a),
  disablePush: (...a) => push.disablePush(...a),
}))

import SettingsPage from '../pages/SettingsPage'

function setPermission(permission) {
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    writable: true,
    value: Object.assign(function Notification() {}, { permission }),
  })
}

function renderPage() {
  return render(<MemoryRouter><SettingsPage /></MemoryRouter>)
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.stubEnv('VITE_FIREBASE_VAPID_KEY', 'test-vapid-key')
  Object.assign(auth, { isAdmin: false, familyId: 'fam1', isDemo: false })
  Object.assign(push, { supported: true, optedOut: false })
  setPermission('default')
})

describe('the settings page', () => {
  it('gives a viewer language, text size and notifications', () => {
    renderPage()
    expect(screen.getByText('Your settings')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Text size' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Notifications' })).toBeInTheDocument()
  })

  it("shows a viewer none of the family's settings", () => {
    renderPage()
    expect(screen.queryByText('family settings')).not.toBeInTheDocument()
  })

  it("shows an admin the family's settings as well", () => {
    auth.isAdmin = true
    renderPage()
    expect(screen.getByText('Your settings')).toBeInTheDocument()
    expect(screen.getByText('family settings')).toBeInTheDocument()
  })
})

describe('the notification switch', () => {
  it('is on where permission is granted and nobody switched it off', () => {
    setPermission('granted')
    renderPage()
    expect(screen.getByRole('switch', { name: 'Notifications' })).toHaveAttribute('aria-checked', 'true')
  })

  it('stays off after it was switched off, though the permission remains', () => {
    setPermission('granted')
    push.optedOut = true
    renderPage()
    expect(screen.getByRole('switch', { name: 'Notifications' })).toHaveAttribute('aria-checked', 'false')
  })

  it('turns on for this family', async () => {
    push.enablePush.mockResolvedValue('token')
    renderPage()
    fireEvent.click(screen.getByRole('switch', { name: 'Notifications' }))
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Notifications' })).toHaveAttribute('aria-checked', 'true'))
    expect(push.enablePush).toHaveBeenCalledWith('fam1')
  })

  it('turns off', async () => {
    setPermission('granted')
    push.disablePush.mockResolvedValue(undefined)
    renderPage()
    fireEvent.click(screen.getByRole('switch', { name: 'Notifications' }))
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Notifications' })).toHaveAttribute('aria-checked', 'false'))
    expect(push.disablePush).toHaveBeenCalled()
  })

  it('says so when the browser refuses, instead of staying off silently', async () => {
    push.enablePush.mockImplementation(async () => {
      setPermission('denied')
      return null
    })
    renderPage()
    fireEvent.click(screen.getByRole('switch', { name: 'Notifications' }))
    expect(await screen.findByText(/blocked for Kaydo in this browser/)).toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('explains where push cannot work rather than offering a switch', () => {
    push.supported = false
    renderPage()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.getByText(/add Kaydo to your home screen/)).toBeInTheDocument()
  })
})
