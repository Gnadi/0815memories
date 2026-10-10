/* A family whose key does not come — none in the document, one this browser
   cannot import, or a document that could not be read — used to get the app
   anyway, keyless, and every write from then on stored family content in
   plaintext. ProtectedRoute shows why instead (AuthContext's keyError). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'

const auth = {}
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../components/KaydoLogo', () => ({ default: () => null }))

import ProtectedRoute from '../components/layout/ProtectedRoute'

const en = JSON.parse(readFileSync('src/locales/en/common.json', 'utf8')).familyKey

function renderPage() {
  return render(
    <MemoryRouter>
      <ProtectedRoute><div>the page</div></ProtectedRoute>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  cleanup()
  Object.assign(auth, {
    isAdmin: true,
    isAuthenticated: true,
    loading: false,
    familyId: 'fam1',
    keyLoading: true,
    keyError: null,
    logout: vi.fn(),
  })
})

describe('a family whose key does not come', () => {
  for (const reason of ['missing', 'unreadable', 'unavailable']) {
    it(`says why instead of opening the app (${reason})`, () => {
      auth.keyError = reason
      renderPage()
      expect(screen.getByText(en.title)).toBeInTheDocument()
      expect(screen.getByText(en[reason])).toBeInTheDocument()
      expect(screen.queryByText('the page')).not.toBeInTheDocument()
    })
  }

  it('lets the member sign out from there', () => {
    auth.keyError = 'missing'
    renderPage()
    fireEvent.click(screen.getByText(en.signOut))
    expect(auth.logout).toHaveBeenCalled()
  })

  it('keeps waiting while the key is only loading', () => {
    renderPage()
    expect(screen.queryByText(en.title)).not.toBeInTheDocument()
    expect(screen.queryByText('the page')).not.toBeInTheDocument()
  })

  it('opens the app once the key is in hand', () => {
    auth.keyLoading = false
    renderPage()
    expect(screen.getByText('the page')).toBeInTheDocument()
  })
})
