/* The sidebar offered viewers four items — Scrapbooks, Recipes, Kids' Journals,
   Black Box — that firestore.rules gates on isFamilyAdmin. Clicking any of them
   mounted a listener the rules deny; /scrapbook did not even redirect, so it just
   sat there empty. Settings was the same defect one page further along: it
   bounced viewers itself, while the sidebar kept advertising it.

   The `adminOnly` mechanism already existed and was already applied to three
   items. These tests pin it to what the rules actually say, so the two cannot
   drift apart again. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'

const auth = { isAdmin: true, isAuthenticated: true, loading: false, keyLoading: false, familyId: 'fam1' }
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../components/KaydoLogo', () => ({ default: () => null }))
vi.mock('../components/LanguageSwitcher', () => ({ default: () => null }))

import Sidebar from '../components/layout/Sidebar'
import ProtectedRoute from '../components/layout/ProtectedRoute'

function renderSidebar() {
  return render(<MemoryRouter><Sidebar /></MemoryRouter>)
}

beforeEach(() => {
  cleanup()
  Object.assign(auth, {
    isAdmin: true, isAuthenticated: true, loading: false, keyLoading: false, familyId: 'fam1',
  })
})

describe('the sidebar a viewer is shown', () => {
  // Labels come from the real locale file, so a rename cannot quietly pass.
  const en = JSON.parse(readFileSync('src/locales/en/common.json', 'utf8'))
  const label = (key) => key.split('.').reduce((o, k) => o[k], en)

  const ADMIN_ONLY = [
    'nav.scrapbooks', 'nav.collages', 'nav.highlights', 'nav.recipes',
    'nav.kidJournals', 'nav.blackBox', 'nav.ourYear', 'nav.settings',
  ]
  const EVERYONE = ['nav.home', 'nav.timeline']

  it('offers an admin everything', () => {
    auth.isAdmin = true
    renderSidebar()
    for (const key of [...EVERYONE, ...ADMIN_ONLY]) {
      expect(screen.getByText(label(key))).toBeInTheDocument()
    }
  })

  it('offers a viewer nothing it cannot serve', () => {
    auth.isAdmin = false
    renderSidebar()
    for (const key of ADMIN_ONLY) {
      expect(screen.queryByText(label(key))).not.toBeInTheDocument()
    }
  })

  it('still offers a viewer the pages backed by readable collections', () => {
    auth.isAdmin = false
    renderSidebar()
    // memories and moments are world-readable, so these two genuinely work.
    for (const key of EVERYONE) {
      expect(screen.getByText(label(key))).toBeInTheDocument()
    }
  })

  it('keeps the post-memory button for admins only', () => {
    auth.isAdmin = false
    renderSidebar()
    expect(screen.queryByText(label('buttons.postMemory'))).not.toBeInTheDocument()
  })
})

describe('ProtectedRoute adminOnly', () => {
  const Page = () => <div>the page</div>

  it('lets an admin through', () => {
    auth.isAdmin = true
    render(
      <MemoryRouter>
        <ProtectedRoute adminOnly><Page /></ProtectedRoute>
      </MemoryRouter>,
    )
    expect(screen.getByText('the page')).toBeInTheDocument()
  })

  it('turns a viewer away, so a URL is no way around the sidebar', () => {
    auth.isAdmin = false
    render(
      <MemoryRouter>
        <ProtectedRoute adminOnly><Page /></ProtectedRoute>
      </MemoryRouter>,
    )
    expect(screen.queryByText('the page')).not.toBeInTheDocument()
  })

  it('still lets a viewer onto an ordinary protected page', () => {
    auth.isAdmin = false
    render(
      <MemoryRouter>
        <ProtectedRoute><Page /></ProtectedRoute>
      </MemoryRouter>,
    )
    expect(screen.getByText('the page')).toBeInTheDocument()
  })

  it('sends an unauthenticated visitor away regardless', () => {
    auth.isAuthenticated = false
    render(
      <MemoryRouter>
        <ProtectedRoute><Page /></ProtectedRoute>
      </MemoryRouter>,
    )
    expect(screen.queryByText('the page')).not.toBeInTheDocument()
  })

  it('waits rather than deciding while the encryption key is still loading', () => {
    auth.keyLoading = true
    render(
      <MemoryRouter>
        <ProtectedRoute adminOnly><Page /></ProtectedRoute>
      </MemoryRouter>,
    )
    // Neither rendered nor redirected — a spinner, as before.
    expect(screen.queryByText('the page')).not.toBeInTheDocument()
  })
})

describe('the route table agrees with the rules', () => {
  const app = readFileSync('src/App.jsx', 'utf8')
  const rules = readFileSync('firestore.rules', 'utf8')

  // Every collection whose read rule requires isFamilyAdmin, and the route
  // prefixes backed by it.
  const ADMIN_COLLECTIONS = {
    scrapbooks: ['scrapbook'],
    recipes: ['recipes'],
    journals: ['journal'],
    blackbox: ['blackbox'],
    collages: ['collages', 'collage/:id'],
    highlights: ['highlights', 'highlight/:id'],
  }

  it('gates every route whose collection the rules gate', () => {
    for (const [collectionName, paths] of Object.entries(ADMIN_COLLECTIONS)) {
      const block = rules.slice(rules.indexOf(`match /${collectionName}/`))
      const readRule = block.slice(0, block.indexOf('allow create'))
      expect(readRule).toContain('isFamilyAdmin')

      for (const path of paths) {
        // Anything under this prefix must use protectAdmin, never plain protect.
        const plain = new RegExp(`path: '${path.replace(/[:/]/g, '\\$&')}[^']*', element: protect\\(`)
        expect(app).not.toMatch(plain)
      }
    }
  })

  it('leaves the pages a viewer can genuinely use ungated', () => {
    for (const path of ['home', 'timeline', 'moments']) {
      expect(app).toContain(`path: '${path}', element: protect(`)
    }
  })
})
