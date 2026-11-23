import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import i18n from '../i18n'

/**
 * The login page as a keyboard, screen reader or password manager meets it.
 *
 * It used to render a phone and a desktop layout side by side, each with its
 * own form, so every field, heading and error existed twice. Its labels were
 * not tied to their fields, errors appeared without being announced, and the
 * sign-in dialog of a custom-designed page let Tab wander out behind it.
 */

const loginAsViewer = vi.fn()
const loginAsAdmin = vi.fn()
const family = vi.hoisted(() => ({ current: null }))

// Head needs the HelmetProvider only the real app sets up.
vi.mock('vite-react-ssg', () => ({ Head: () => null }))
vi.mock('../config/firebase', () => ({ db: { type: 'test' }, auth: null, functions: null }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false, firebaseReady: true,
    loginAsViewer, loginAsAdmin, sendAdminPasswordReset: vi.fn(),
  }),
}))
vi.mock('../utils/familySlug', () => ({ getSubdomainSlug: () => null }))
vi.mock('../services/family', () => ({
  resolveFamilyBySlug: vi.fn(async () => family.current),
  getFamilyPublic: vi.fn(async () => null),
}))
// The canvas renders the family's own HTML into a shadow root; its content
// does not matter here.
vi.mock('../components/CustomLoginCanvas', () => ({
  default: () => <a href="#behind">link behind the dialog</a>,
}))

import LoginPage from '../pages/LoginPage'

function renderAt(entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/family/:slug" element={<LoginPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('login page accessibility', () => {
  beforeEach(() => {
    window.localStorage.clear()
    loginAsViewer.mockReset()
    loginAsAdmin.mockReset()
    family.current = { id: 'family-1', familyName: 'The Millers', loginPageMode: 'classic' }
  })

  it.each(['classic', 'theme'])('renders one form and one heading on a %s page', async (mode) => {
    family.current = { ...family.current, loginPageMode: mode, loginTheme: { textColor: '#ffffff', accentColor: '#c2185b' } }
    const { container } = renderAt('/family/the-millers')
    await screen.findByRole('heading', { level: 1 })
    expect(container.querySelectorAll('form')).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(container.querySelectorAll('input[type="password"]')).toHaveLength(1)
  })

  it('ties labels to fields and tells password managers what they hold', async () => {
    renderAt('/login?admin=1')
    const email = await screen.findByLabelText('Family Email')
    const key = screen.getByLabelText('Private Key')
    expect(email).toHaveAttribute('autocomplete', 'username')
    expect(email).toHaveAttribute('name', 'email')
    expect(key).toHaveAttribute('autocomplete', 'current-password')
    expect(key).toHaveAttribute('name', 'password')
  })

  it('announces an error and points the fields at it', async () => {
    loginAsAdmin.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/invalid-credential' }))
    renderAt('/login?admin=1')
    fireEvent.change(await screen.findByLabelText('Family Email'), { target: { value: 'a@example.com' } })
    fireEvent.change(screen.getByLabelText('Private Key'), { target: { value: 'wrong-secret' } })
    fireEvent.submit(screen.getByLabelText('Private Key').closest('form'))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Invalid email or password')
    const key = screen.getByLabelText('Private Key')
    expect(key).toHaveAttribute('aria-invalid', 'true')
    expect(key).toHaveAttribute('aria-describedby', alert.id)
  })

  it('tells a family member who forgot the key whom to ask', async () => {
    renderAt('/family/the-millers')
    const forgot = await screen.findByRole('button', { name: 'Forgot the key?' })
    expect(forgot).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(forgot)
    expect(forgot).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/Ask whoever looks after Kaydo for your family/)).toBeInTheDocument()
  })

  it('offers admins their password reset instead', async () => {
    renderAt('/login?admin=1')
    expect(await screen.findByRole('button', { name: 'Forgot password?' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Forgot the key?' })).toBeNull()
  })

  it('offers text size and language before signing in', async () => {
    renderAt('/family/the-millers')
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByRole('button', { name: 'Adjust text size' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'de' } })
    expect(await screen.findByRole('heading', { name: 'Willkommen bei The Millers' })).toBeInTheDocument()
    await i18n.changeLanguage('en')
  })

  describe('sign-in dialog of a custom page', () => {
    beforeEach(() => {
      family.current = {
        ...family.current, loginPageMode: 'custom', loginCustomHtml: '<p>hi</p>',
        loginCard: { behavior: 'minimized' },
      }
    })

    it('is labelled by its heading and keeps focus inside', async () => {
      renderAt('/family/the-millers')
      fireEvent.click(await screen.findByRole('button', { name: /Sign in/ }))

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAccessibleName('Welcome to The Millers')
      expect(dialog).toContainElement(document.activeElement)
      expect(screen.getByText('link behind the dialog').closest('[inert]')).not.toBeNull()

      // Tab from the last control wraps to the first, and back again.
      const controls = [...dialog.querySelectorAll('input, button')]
      controls.at(-1).focus()
      fireEvent.keyDown(document, { key: 'Tab' })
      expect(document.activeElement).toBe(controls[0])
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
      expect(document.activeElement).toBe(controls.at(-1))
    })

    it('gives focus back to the button that opened it', async () => {
      renderAt('/family/the-millers')
      const open = await screen.findByRole('button', { name: /Sign in/ })
      open.focus()
      fireEvent.click(open)
      fireEvent.keyDown(window, { key: 'Escape' })

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(document.activeElement).toBe(open)
    })
  })
})
