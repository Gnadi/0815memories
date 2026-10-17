/* Viewers get a settings page of their own: language, text size, whether
   this device gets notifications, installing the app and staying logged in. The family's settings below them read and
   write the family document, which firestore.rules keeps to admins, so a
   viewer must not be shown them. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const auth = {
  isAdmin: false, familyId: 'fam1', isDemo: false,
  stayLoggedIn: true, setStayLoggedIn: vi.fn(), logout: vi.fn(),
}
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
const pwa = vi.hoisted(() => ({ canInstall: false, installed: false, ios: false, promptInstall: vi.fn() }))
vi.mock('../hooks/usePWAInstall', () => ({
  default: () => ({ canInstall: pwa.canInstall, installed: pwa.installed, promptInstall: pwa.promptInstall }),
  isIOSBrowser: () => pwa.ios,
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
  Object.assign(auth, { isAdmin: false, familyId: 'fam1', isDemo: false, stayLoggedIn: true })
  Object.assign(pwa, { canInstall: false, installed: false, ios: false })
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
    expect(screen.queryByRole('switch', { name: 'Notifications' })).not.toBeInTheDocument()
  })

  it('explains where push cannot work rather than offering a switch', () => {
    push.supported = false
    renderPage()
    expect(screen.queryByRole('switch', { name: 'Notifications' })).not.toBeInTheDocument()
    expect(screen.getByText(/add Kaydo to your home screen/)).toBeInTheDocument()
  })
})

describe('staying logged in', () => {
  it('shows what the login chose', () => {
    auth.stayLoggedIn = false
    renderPage()
    expect(screen.getByRole('switch', { name: 'Stay logged in' })).toHaveAttribute('aria-checked', 'false')
  })

  it('changes it for the open session', async () => {
    auth.setStayLoggedIn.mockResolvedValue(undefined)
    renderPage()
    fireEvent.click(screen.getByRole('switch', { name: 'Stay logged in' }))
    await waitFor(() => expect(auth.setStayLoggedIn).toHaveBeenCalledWith(false))
  })

  it('says so when it could not be changed', async () => {
    auth.setStayLoggedIn.mockRejectedValue(new Error('indexeddb blocked'))
    renderPage()
    fireEvent.click(screen.getByRole('switch', { name: 'Stay logged in' }))
    expect(await screen.findByText(/didn't work/)).toBeInTheDocument()
  })

  it('offers a way out', async () => {
    auth.logout.mockResolvedValue(undefined)
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Leave the Room' }))
    await waitFor(() => expect(auth.logout).toHaveBeenCalled())
  })
})

describe('installing the app', () => {
  it('offers the browser\'s install prompt where there is one', () => {
    pwa.canInstall = true
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Install Kaydo' }))
    expect(pwa.promptInstall).toHaveBeenCalled()
  })

  it('explains the share menu on an iPhone, which has no prompt', () => {
    pwa.ios = true
    renderPage()
    expect(screen.queryByRole('button', { name: 'Install Kaydo' })).not.toBeInTheDocument()
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument()
  })

  it('says when it is installed already', () => {
    pwa.installed = true
    renderPage()
    expect(screen.getByText('Kaydo is installed on this device.')).toBeInTheDocument()
  })
})
