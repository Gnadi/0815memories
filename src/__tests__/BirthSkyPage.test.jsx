import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import BirthSkyPage from '../pages/BirthSkyPage'

vi.mock('../config/firebase', () => ({ db: null, auth: null, messaging: null }))
vi.mock('firebase/firestore', () => ({
  Timestamp: { now: vi.fn(), fromDate: vi.fn() },
  deleteField: () => 'DELETE_FIELD',
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

const mockUpdateKid = vi.fn()
let mockKid
vi.mock('../hooks/useKids', () => ({
  useKids: () => ({ kids: mockKid ? [mockKid] : [], loading: false, updateKid: mockUpdateKid }),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/journal/kid-1/sky']}>
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
    expect(mockUpdateKid.mock.calls[0][1].birthTime).toBe('DELETE_FIELD')
  })

  it('goes back to the journal list for an unknown child', () => {
    mockKid = null
    renderPage()
    expect(screen.getByText('journal list')).toBeInTheDocument()
  })
})
