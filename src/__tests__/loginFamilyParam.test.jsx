import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const loginAsViewer = vi.fn(async () => {})
const subdomain = vi.hoisted(() => ({ slug: null }))

vi.mock('../config/firebase', () => ({ db: { type: 'test' }, auth: null, functions: null }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false, firebaseReady: true,
    loginAsViewer, loginAsAdmin: vi.fn(), sendAdminPasswordReset: vi.fn(),
  }),
}))
vi.mock('../utils/familySlug', () => ({ getSubdomainSlug: () => subdomain.slug }))

const OWN = {
  id: 'ownFamilyId', familyName: 'The Millers', familySlug: 'the-millers', loginPageMode: 'classic',
}
const FOREIGN = {
  familyName: 'Foreign Family', loginPageMode: 'custom',
  loginCustomHtml: '<h1 id="foreign">Foreign family content</h1>',
  loginCustomCss: '.canvas{background:#000}',
}

const later = (value, ms) => new Promise((resolve) => setTimeout(() => resolve(value), ms))

const getFamilyPublic = vi.hoisted(() => vi.fn())
vi.mock('../services/family', () => ({
  resolveFamilyBySlug: vi.fn(() => later(OWN, 10)),
  getFamilyPublic,
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

const shadowHost = (container) => [...container.querySelectorAll('div')].find((el) => el.shadowRoot)

describe('LoginPage ?family= parameter', () => {
  beforeEach(() => {
    window.localStorage.clear()
    subdomain.slug = null
    loginAsViewer.mockClear()
    getFamilyPublic.mockReset()
    getFamilyPublic.mockImplementation(() => later(FOREIGN, 60))
  })

  it('ignores ?family= on a family subdomain', async () => {
    subdomain.slug = 'the-millers'
    const { container } = renderAt('/login?family=foreignFamilyId')
    await later(null, 200)
    expect(getFamilyPublic).not.toHaveBeenCalled()
    expect(shadowHost(container)).toBeUndefined()
    expect(container.textContent).not.toContain('Foreign family content')
    expect(window.localStorage.getItem('kaydo_login_page:foreignFamilyId')).toBeNull()
  })

  it('ignores ?family= on a /family/:slug route and logs into the slug family', async () => {
    const { container } = renderAt('/family/the-millers?family=foreignFamilyId')
    await later(null, 200)
    expect(getFamilyPublic).not.toHaveBeenCalled()
    expect(shadowHost(container)).toBeUndefined()

    const pw = container.querySelector('input[type="password"]')
    fireEvent.change(pw, { target: { value: 'a-long-enough-secret' } })
    fireEvent.submit(pw.closest('form'))
    await waitFor(() => expect(loginAsViewer).toHaveBeenCalled())
    expect(loginAsViewer.mock.calls[0][1]).toBe('ownFamilyId')
  })

  it('still uses ?family= on a plain /login visit', async () => {
    const { container } = renderAt('/login?family=foreignFamilyId')
    await waitFor(() => {
      expect(shadowHost(container)).toBeTruthy()
      expect(shadowHost(container).shadowRoot.innerHTML).toContain('Foreign family content')
    }, { timeout: 2000 })
    expect(getFamilyPublic).toHaveBeenCalledWith('foreignFamilyId')
  })
})
