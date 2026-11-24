/**
 * Where a family takes over a birth sky made on the public page —
 * pages/BirthSkyContinuePage.jsx.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import BirthSkyContinuePage from '../pages/BirthSkyContinuePage'
import { SKY_DRAFT_KEY, saveSkyDraft } from '../utils/sky/skyDraft'

vi.mock('../config/firebase', () => ({ db: null, auth: null, messaging: null }))
vi.mock('firebase/firestore', () => ({
  Timestamp: { fromDate: (date) => ({ iso: date.toISOString() }) },
}))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true, familyId: 'fam-1', encryptionKey: null }),
}))
const mockAddKid = vi.fn()
const mockUpdateKid = vi.fn()
let mockKids
vi.mock('../hooks/useKids', () => ({
  useKids: () => ({ kids: mockKids, loading: false, addKid: mockAddKid, updateKid: mockUpdateKid }),
}))

const LINZ = { name: 'Linz', country: 'AT', lat: 48.31, lon: 14.29, tz: 'Europe/Vienna' }

function SkyPage() {
  const location = useLocation()
  return <p>sky of {location.pathname} {JSON.stringify(location.state)}</p>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/birth-sky/continue']}>
      <Routes>
        <Route path="/birth-sky/continue" element={<BirthSkyContinuePage />} />
        <Route path="/journal/:childId/sky" element={<SkyPage />} />
        <Route path="/journal" element={<p>journal list</p>} />
        <Route path="/home" element={<p>home</p>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  localStorage.clear()
  mockKids = []
  mockAddKid.mockReset().mockResolvedValue('kid-new')
  mockUpdateKid.mockReset().mockResolvedValue()
  saveSkyDraft({
    name: 'Leo',
    birthDate: '2026-11-20',
    birthTime: '04:17',
    birthPlace: LINZ,
    skyStyle: 'kaydo',
    title: 'Leo',
    dedication: 'Willkommen',
    order: true,
  })
})

describe('BirthSkyContinuePage', () => {
  it('adds the child with the birth details, then opens the birth sky to order', async () => {
    renderPage()
    fireEvent.click(screen.getByText('Continue to the birth sky'))
    await waitFor(() => expect(mockAddKid).toHaveBeenCalledTimes(1))
    expect(mockAddKid).toHaveBeenCalledWith({
      name: 'Leo',
      birthdate: { iso: '2026-11-20T00:00:00.000Z' },
      profilePhoto: '',
      profilePhotoPublicId: '',
      birthTime: '04:17',
      birthPlace: LINZ,
      skyStyle: 'kaydo',
    })
    expect(await screen.findByText(/sky of \/journal\/kid-new\/sky/)).toHaveTextContent(
      '{"skyPoster":{"title":"Leo","dedication":"Willkommen","order":true}}',
    )
    expect(localStorage.getItem(SKY_DRAFT_KEY)).toBeNull()
  })

  it('puts the time, place and style onto a child already in the family', async () => {
    mockKids = [{ id: 'kid-1', name: 'Leo' }]
    renderPage()
    fireEvent.click(screen.getByLabelText(/Leo, who is already in the family/))
    fireEvent.click(screen.getByText('Continue to the birth sky'))
    await waitFor(() => expect(mockUpdateKid).toHaveBeenCalledWith('kid-1', {
      birthTime: '04:17',
      birthPlace: LINZ,
      skyStyle: 'kaydo',
    }))
    expect(mockAddKid).not.toHaveBeenCalled()
    expect(await screen.findByText(/sky of \/journal\/kid-1\/sky/)).toBeInTheDocument()
  })

  it('keeps the draft when saving fails, so it can be tried again', async () => {
    mockAddKid.mockRejectedValue(new Error('offline'))
    renderPage()
    fireEvent.click(screen.getByText('Continue to the birth sky'))
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not work')
    expect(localStorage.getItem(SKY_DRAFT_KEY)).not.toBeNull()
  })

  it('can be discarded', () => {
    renderPage()
    fireEvent.click(screen.getByText('Discard the poster'))
    expect(screen.getByText('home')).toBeInTheDocument()
    expect(localStorage.getItem(SKY_DRAFT_KEY)).toBeNull()
  })

  it('has nothing to do without a draft', () => {
    localStorage.clear()
    renderPage()
    expect(screen.getByText('journal list')).toBeInTheDocument()
  })
})
