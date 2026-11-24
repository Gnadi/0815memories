import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import BirthSkyPage from '../pages/BirthSkyPage'

vi.mock('../config/firebase', () => ({ db: null, auth: null, messaging: null }))
vi.mock('firebase/firestore', () => ({
  Timestamp: { now: vi.fn(), fromDate: vi.fn() },
}))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true, familyId: 'test-family', encryptionKey: null, isAuthenticated: true }),
}))
vi.mock('../components/layout/Sidebar', () => ({ default: () => <div data-testid="sidebar" /> }))
vi.mock('../hooks/useMemories', () => ({ useMemoryWriter: () => ({ addMemory: vi.fn() }) }))
vi.mock('../utils/encryptedUpload', () => ({ encryptAndUploadWithThumb: vi.fn() }))
vi.mock('../utils/sky/skyData', async (importOriginal) => ({
  ...(await importOriginal()),
  loadSkyCatalog: () => Promise.resolve({ stars: [[37.95, 89.26, 1.97, 0.6]], constellations: [] }),
}))

// Printing on, as a deployment with Peecho has it.
vi.mock('../utils/printBook', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, printConfig: () => ({ ...actual.printConfig({}), enabled: true }) }
})

const mockDraw = vi.hoisted(() => vi.fn())
vi.mock('../utils/sky/skyRenderer', async (importOriginal) => ({
  ...(await importOriginal()),
  drawSkyPoster: (...args) => mockDraw(...args),
}))

const mockUpdateKid = vi.fn()
let mockKid
vi.mock('../hooks/useKids', () => ({
  useKids: () => ({ kids: mockKid ? [mockKid] : [], loading: false, updateKid: mockUpdateKid }),
}))

function renderPage(state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/journal/kid-1/sky', state }]}>
      <Routes>
        <Route path="/journal/:childId/sky" element={<BirthSkyPage />} />
        <Route path="/journal" element={<p>journal list</p>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  // jsdom has no canvas; the page skips drawing when there is no context.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  mockUpdateKid.mockReset().mockResolvedValue()
  mockKid = { id: 'kid-1', name: 'Leo', birthdate: { toDate: () => new Date('2021-05-03') } }
})

describe('BirthSkyPage', () => {
  it('asks for the birthplace before it can draw a sky', async () => {
    renderPage()
    expect(screen.getByText('Sky of Birth')).toBeInTheDocument()
    expect(screen.getByText('May 3, 2021')).toBeInTheDocument()
    expect(await screen.findByText('Choose the place of birth to see the sky.')).toBeInTheDocument()
    expect(screen.getByText('Download PDF (A4)').closest('button')).toBeDisabled()
  })

  it('saves the time, a manually entered place with its time zone, and the style', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('Time of birth'), { target: { value: '04:17' } })
    fireEvent.click(screen.getByText('Not in the list? Enter coordinates'))
    fireEvent.change(screen.getByPlaceholderText('Name (e.g. St. Wolfgang)'), { target: { value: 'Linz' } })
    fireEvent.change(screen.getByPlaceholderText('Latitude'), { target: { value: '48.30639' } })
    fireEvent.change(screen.getByPlaceholderText('Longitude'), { target: { value: '14.28611' } })
    fireEvent.click(screen.getByText('Use these coordinates'))
    fireEvent.click(screen.getByText('Kaydo'))

    await waitFor(() => expect(screen.getByText('Download PDF (A4)').closest('button')).toBeEnabled())
    fireEvent.click(screen.getByText('Save details'))

    await waitFor(() => expect(mockUpdateKid).toHaveBeenCalledTimes(1))
    expect(mockUpdateKid).toHaveBeenCalledWith('kid-1', {
      birthTime: '04:17',
      birthPlace: { name: 'Linz', country: '', lat: 48.31, lon: 14.29, tz: 'Europe/Vienna' },
      skyStyle: 'kaydo',
    })
  })

  it('removes a cleared birth time instead of storing an empty one', async () => {
    mockKid = {
      ...mockKid,
      birthTime: '04:17',
      birthPlace: { name: 'Linz', country: 'AT', lat: 48.31, lon: 14.29, tz: 'Europe/Vienna' },
    }
    renderPage()
    fireEvent.change(screen.getByLabelText('Time of birth'), { target: { value: '' } })
    fireEvent.click(screen.getByText('Save details'))
    await waitFor(() => expect(mockUpdateKid).toHaveBeenCalledTimes(1))
    // null, which services/kids.js turns into a deleted field.
    expect(mockUpdateKid.mock.calls[0][1].birthTime).toBeNull()
  })

  it('goes back to the journal list for an unknown child', () => {
    mockKid = null
    renderPage()
    expect(screen.getByText('journal list')).toBeInTheDocument()
  })

  it('redraws the preview once typing in the title pauses, not on every key', async () => {
    // Drawing takes 100–200 ms on a phone; it used to run for every key.
    HTMLCanvasElement.prototype.getContext.mockReturnValue({})
    mockDraw.mockReset()
    mockKid = {
      ...mockKid,
      birthPlace: { name: 'Linz', country: 'AT', lat: 48.31, lon: 14.29, tz: 'Europe/Vienna' },
    }
    renderPage()
    await waitFor(() => expect(mockDraw).toHaveBeenCalled())
    // The sky, the fonts and the form arrive one after another; let them land.
    await new Promise((resolve) => setTimeout(resolve, 300))
    mockDraw.mockClear()

    const title = screen.getByDisplayValue('Leo')
    for (const value of ['Leo ', 'Leo i', 'Leo is', 'Leo is here']) {
      fireEvent.change(title, { target: { value } })
    }
    expect(mockDraw).not.toHaveBeenCalled()
    await waitFor(() => expect(mockDraw).toHaveBeenCalledTimes(1))
    expect(JSON.stringify(mockDraw.mock.calls[0][1].caption)).toContain('Leo is here')
  })

  it('offers the poster as a wall print once the sky is drawn', async () => {
    mockKid = {
      ...mockKid,
      birthPlace: { name: 'Linz', country: 'AT', lat: 48.31, lon: 14.29, tz: 'Europe/Vienna' },
    }
    renderPage()
    const order = screen.getByRole('button', { name: 'Order as a wall print' })
    await waitFor(() => expect(order).toBeEnabled())
    fireEvent.click(order)
    expect(screen.getByRole('dialog', { name: 'Order the birth sky' })).toBeInTheDocument()
    expect(screen.getByText('This file is not encrypted')).toBeInTheDocument()
    expect(screen.getByText('A poster of 29.7 × 42 cm')).toBeInTheDocument()
  })

  it('takes over the caption of a poster made on the public page, and its order', async () => {
    renderPage({ skyPoster: { title: 'Leo Sternchen', dedication: 'Willkommen', order: true } })
    expect(await screen.findByDisplayValue('Leo Sternchen')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Willkommen')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Order the birth sky' })).toBeInTheDocument()
  })
})
