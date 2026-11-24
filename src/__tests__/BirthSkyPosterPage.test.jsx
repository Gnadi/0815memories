/**
 * A birth sky ordered for the poster only, the child not added to the family —
 * pages/BirthSkyPosterPage.jsx.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import BirthSkyPosterPage from '../pages/BirthSkyPosterPage'
import { SKY_DRAFT_KEY, saveSkyDraft } from '../utils/sky/skyDraft'

vi.mock('../config/firebase', () => ({ db: null, auth: null, messaging: null, functions: null }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true, familyId: 'fam-1', encryptionKey: null }),
}))
vi.mock('../components/layout/Sidebar', () => ({ default: () => null }))
vi.mock('../utils/printBook', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, printConfig: () => ({ ...actual.printConfig({}), enabled: true }) }
})
vi.mock('../utils/sky/skyData', async (importOriginal) => ({
  ...(await importOriginal()),
  loadSkyCatalog: () => Promise.resolve({ stars: [[37.95, 89.26, 1.97, 0.6]], constellations: [] }),
}))
const mockRender = vi.fn()
vi.mock('../utils/sky/posterExport', async (importOriginal) => ({
  ...(await importOriginal()),
  renderPosterPrintFile: (...args) => mockRender(...args),
}))
const mockUpload = vi.fn()
vi.mock('../utils/printUpload', () => ({ uploadPrintFile: (...args) => mockUpload(...args) }))
const mockCheckout = vi.fn()
vi.mock('../utils/printCheckout', () => ({ createPrintCheckout: (...args) => mockCheckout(...args) }))

const LINZ = { name: 'Linz', country: 'AT', lat: 48.31, lon: 14.29, tz: 'Europe/Vienna' }

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/birth-sky/poster']}>
      <Routes>
        <Route path="/birth-sky/poster" element={<BirthSkyPosterPage />} />
        <Route path="/home" element={<p>home</p>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  localStorage.clear()
  mockRender.mockReset().mockResolvedValue({ pdf: new Blob(['%PDF']), thumbnail: new Blob(['jpg']), pageCount: 1, format: { widthMm: 297, heightMm: 420 } })
  mockUpload.mockReset().mockResolvedValue({ printId: 'print-1', pdfUrl: 'https://storage.example/book.pdf', thumbnailUrl: null })
  mockCheckout.mockReset().mockResolvedValue({ checkoutUrl: 'https://test.www.peecho.com/checkout/x', expiresAt: '2026-12-01T10:00:00Z' })
  saveSkyDraft({ name: 'Lena', birthDate: '2026-11-20', birthTime: '04:17', birthPlace: LINZ, skyStyle: 'kaydo', title: 'Lena', dedication: 'Hallo', order: true })
})

describe('BirthSkyPosterPage', () => {
  it('orders the poster from the draft, and forgets the draft once the checkout is open', async () => {
    renderPage()
    expect(screen.getByDisplayValue('Hallo')).toBeInTheDocument()
    const dialog = screen.getByRole('dialog', { name: 'Order the birth sky' })
    const prepare = screen.getByRole('button', { name: 'Prepare the print file' })
    await waitFor(() => expect(prepare).toBeEnabled())
    fireEvent.click(prepare)

    expect(await screen.findByText("Go to Peecho's checkout")).toBeInTheDocument()
    expect(mockUpload).toHaveBeenCalledWith(expect.objectContaining({ familyId: 'fam-1' }))
    expect(mockCheckout).toHaveBeenCalledWith(expect.objectContaining({ product: 'poster', pageCount: 1, title: 'Lena' }))
    expect(dialog).toBeInTheDocument()
    expect(localStorage.getItem(SKY_DRAFT_KEY)).toBeNull()
  })

  it('keeps the draft when the checkout fails, to try again later', async () => {
    mockCheckout.mockRejectedValue(new Error('unavailable'))
    renderPage()
    const prepare = screen.getByRole('button', { name: 'Prepare the print file' })
    await waitFor(() => expect(prepare).toBeEnabled())
    fireEvent.click(prepare)
    expect(await screen.findByRole('alert')).toHaveTextContent('Peecho did not open a checkout')
    expect(localStorage.getItem(SKY_DRAFT_KEY)).not.toBeNull()
  })

  it('can be discarded', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByText('Discard the poster'))
    expect(screen.getByText('home')).toBeInTheDocument()
    expect(localStorage.getItem(SKY_DRAFT_KEY)).toBeNull()
  })

  it('has nothing to show without a draft', () => {
    localStorage.clear()
    renderPage()
    expect(screen.getByText('home')).toBeInTheDocument()
  })
})
