/**
 * The birth sky without an account — pages/PublicBirthSkyPage.jsx, the way in
 * from the landing page.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PublicBirthSkyPage from '../pages/PublicBirthSkyPage'
import { SKY_DRAFT_KEY } from '../utils/sky/skyDraft'

vi.mock('vite-react-ssg', () => ({ Head: () => null }))
let mockAuth
vi.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }))
vi.mock('../utils/printBook', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, printConfig: () => ({ ...actual.printConfig({}), enabled: true }) }
})
vi.mock('../utils/sky/skyData', async (importOriginal) => ({
  ...(await importOriginal()),
  loadSkyCatalog: () => Promise.resolve({ stars: [[37.95, 89.26, 1.97, 0.6]], constellations: [] }),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/birth-sky']}>
      <Routes>
        <Route path="/birth-sky" element={<PublicBirthSkyPage />} />
        <Route path="/signup" element={<p>signup page</p>} />
        <Route path="/login" element={<p>login page</p>} />
        <Route path="/birth-sky/continue" element={<p>continue page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

function fillIn() {
  fireEvent.change(screen.getByLabelText("Child's name"), { target: { value: 'Leo' } })
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-20' } })
  fireEvent.change(screen.getByLabelText('Time of birth'), { target: { value: '04:17' } })
  fireEvent.click(screen.getByText('Not in the list? Enter coordinates'))
  fireEvent.change(screen.getByPlaceholderText('Name (e.g. St. Wolfgang)'), { target: { value: 'Linz' } })
  fireEvent.change(screen.getByPlaceholderText('Latitude'), { target: { value: '48.30639' } })
  fireEvent.change(screen.getByPlaceholderText('Longitude'), { target: { value: '14.28611' } })
  fireEvent.click(screen.getByText('Use these coordinates'))
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  localStorage.clear()
  mockAuth = { isAuthenticated: false, isAdmin: false, familyId: null }
})

describe('PublicBirthSkyPage', () => {
  it('needs the birth before anything can be downloaded or kept', async () => {
    renderPage()
    expect(screen.getByText('Download PDF (A4)').closest('button')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Create a free account and order' })).toBeDisabled()
    expect(await screen.findByText('Choose the place of birth to see the sky.')).toBeInTheDocument()
  })

  it('lets anyone download it once the birth is in, and titles it with the name', async () => {
    renderPage()
    fillIn()
    await waitFor(() => expect(screen.getByText('Download PDF (A4)').closest('button')).toBeEnabled())
    expect(screen.getByLabelText('Title')).toHaveValue('Leo')
    // Nothing is kept in the browser until the visitor asks for it.
    expect(localStorage.getItem(SKY_DRAFT_KEY)).toBeNull()
  })

  it('keeps the poster through signing up, to be ordered', async () => {
    renderPage()
    fillIn()
    fireEvent.change(screen.getByLabelText('A line of your own'), { target: { value: 'Willkommen' } })
    const order = screen.getByRole('button', { name: 'Create a free account and order' })
    await waitFor(() => expect(order).toBeEnabled())
    fireEvent.click(order)

    expect(screen.getByText('signup page')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(SKY_DRAFT_KEY))).toMatchObject({
      name: 'Leo',
      birthDate: '2026-11-20',
      birthTime: '04:17',
      birthPlace: { name: 'Linz', lat: 48.31, lon: 14.29, tz: 'Europe/Vienna' },
      title: 'Leo',
      dedication: 'Willkommen',
      order: true,
    })
  })

  it('takes a signed-in admin straight to their family', async () => {
    mockAuth = { isAuthenticated: true, isAdmin: true, familyId: 'fam-1' }
    renderPage()
    fillIn()
    const order = screen.getByRole('button', { name: 'Create a free account and order' })
    await waitFor(() => expect(order).toBeEnabled())
    fireEvent.click(order)
    expect(screen.getByText('continue page')).toBeInTheDocument()
  })
})
