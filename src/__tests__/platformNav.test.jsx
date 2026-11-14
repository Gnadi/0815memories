/* The admin tab bar takes the look of the phone it runs on, and its create
   sheet closes on the back button instead of leaving the page underneath:
   Android's back button is part of the phone, so people pressed it to dismiss
   the sheet and lost the page they were on. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { detectPlatform } from '../utils/platform'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true, familyId: 'fam1', encryptionKey: null }),
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }))
vi.mock('../i18n', () => ({ LANDING_PATHS: { en: '/', de: '/de' } }))

import AdminMobileBottomNav from '../components/layout/AdminMobileBottomNav'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const PIXEL = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'

function setDevice(userAgent, platform = '', maxTouchPoints = 0) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform)
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, get: () => maxTouchPoints })
}

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

function renderNav() {
  return render(
    <MemoryRouter initialEntries={['/home']}>
      <AdminMobileBottomNav />
      <Routes><Route path="*" element={<Where />} /></Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => cleanup())
afterEach(() => vi.restoreAllMocks())

describe('detectPlatform', () => {
  it('tells iPhone, iPad, Android and the rest apart', () => {
    setDevice(IPHONE)
    expect(detectPlatform()).toBe('ios')
    setDevice(PIXEL, 'Linux armv8l')
    expect(detectPlatform()).toBe('android')
    // iPadOS Safari says it is a Mac; a Mac has no touch screen.
    setDevice(MAC, 'MacIntel', 5)
    expect(detectPlatform()).toBe('ios')
    setDevice(MAC, 'MacIntel', 0)
    expect(detectPlatform()).toBe('other')
  })
})

describe('AdminMobileBottomNav', () => {
  it('renders the tab bar of the platform', () => {
    setDevice(IPHONE)
    const { container, unmount } = renderNav()
    expect(container.querySelector('nav').dataset.platform).toBe('ios')
    unmount()
    setDevice(PIXEL)
    renderNav()
    expect(document.querySelector('nav').dataset.platform).toBe('android')
    // The active tab is the same on both, only its look differs.
    expect(screen.getByRole('button', { name: 'mobileNav.home' })).toHaveAttribute('aria-current', 'page')
  })

  it('closes the create sheet on back and stays on the page', () => {
    setDevice(PIXEL)
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    renderNav()
    fireEvent.click(screen.getByRole('button', { name: 'mobileNav.create' }))
    expect(screen.getByText('createSheet.title')).toBeInTheDocument()
    expect(window.history.state.kaydoSheet).toBe(true)

    act(() => { window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(screen.queryByText('createSheet.title')).not.toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveTextContent('/home')
    // The browser already went back; going back again would leave the page.
    expect(back).not.toHaveBeenCalled()
  })

  it('takes the sheet history entry back when the sheet is dismissed', () => {
    setDevice(IPHONE)
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    renderNav()
    fireEvent.click(screen.getByRole('button', { name: 'mobileNav.create' }))
    fireEvent.click(screen.getByText('buttons.cancel'))
    expect(screen.queryByText('createSheet.title')).not.toBeInTheDocument()
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('goes to the chosen page without going back first', () => {
    setDevice(PIXEL)
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    renderNav()
    fireEvent.click(screen.getByRole('button', { name: 'mobileNav.create' }))
    fireEvent.click(screen.getByText('createSheet.createCollage'))
    expect(screen.getByTestId('where')).toHaveTextContent('/collages')
    expect(back).not.toHaveBeenCalled()
  })
})
