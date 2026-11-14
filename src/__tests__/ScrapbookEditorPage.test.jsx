/* Leaving the scrapbook editor. Autosave waits two seconds, and the back
   button used to navigate straight away, so a title changed or a photo placed
   just before leaving was never written. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../config/firebase', () => ({ db: {}, auth: null, messaging: null }))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ familyId: 'test-family', encryptionKey: null, isAuthenticated: true, isAdmin: true }),
}))

const mockUpdateScrapbook = vi.fn()
vi.mock('../hooks/useScrapbooks', () => ({
  useScrapbookWriter: () => ({ updateScrapbook: mockUpdateScrapbook }),
}))

vi.mock('../services/scrapbooks', () => ({
  getScrapbook: vi.fn(async () => ({
    id: 'book-1',
    title: 'Summer',
    pages: [{ id: 'page-1', backgroundColor: '#fff', backgroundPattern: 'none', elements: [], customizable: true }],
  })),
}))

vi.mock('../hooks/useMemoryPhotos', () => ({
  useMemoryPhotos: () => ({ photos: [], loading: false }),
}))

vi.mock('../hooks/useScrapbookPhotoUpload', () => ({
  useScrapbookPhotoUpload: () => ({ upload: vi.fn(), uploading: false, session: [] }),
}))

vi.mock('../components/media/EncryptedImage', () => ({
  default: ({ alt, className }) => <img alt={alt} className={className} />,
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'book-1' }),
  useNavigate: () => mockNavigate,
}))

// jsdom has no ResizeObserver; the canvas only uses it to fit itself on screen.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }

const ScrapbookEditorPage = (await import('../pages/ScrapbookEditorPage')).default

async function renameAndLeave(user) {
  render(<ScrapbookEditorPage />)
  await user.click(await screen.findByText('Summer'))
  const input = screen.getByDisplayValue('Summer')
  await user.clear(input)
  await user.type(input, 'Autumn{Enter}')
  await user.click(screen.getByTitle('Back to Scrapbooks'))
}

describe('ScrapbookEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateScrapbook.mockResolvedValue(undefined)
  })

  it('writes the pending change out before going back', async () => {
    const user = userEvent.setup()
    await renameAndLeave(user)

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/scrapbook'))
    expect(mockUpdateScrapbook).toHaveBeenCalledTimes(1)
    expect(mockUpdateScrapbook.mock.calls[0][1].title).toBe('Autumn')
    // The write came first: navigating is only allowed once it has landed.
    expect(mockUpdateScrapbook.mock.invocationCallOrder[0])
      .toBeLessThan(mockNavigate.mock.invocationCallOrder[0])
  })

  it('does not go back without asking when that write fails', async () => {
    mockUpdateScrapbook.mockRejectedValue(new Error('offline'))
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    await renameAndLeave(user)

    await waitFor(() => expect(confirm).toHaveBeenCalled())
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(screen.getAllByTitle('Not saved').length).toBeGreaterThan(0)
    confirm.mockRestore()
  })

  it('goes straight back when nothing changed', async () => {
    const user = userEvent.setup()
    render(<ScrapbookEditorPage />)
    await user.click(await screen.findByTitle('Back to Scrapbooks'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/scrapbook'))
    expect(mockUpdateScrapbook).not.toHaveBeenCalled()
  })
})
