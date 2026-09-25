import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Mocks — declared before the page under test is imported
// ---------------------------------------------------------------------------

vi.mock('../config/firebase', () => ({ db: {}, auth: null, messaging: null }))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ familyId: 'test-family', encryptionKey: null, isAuthenticated: true, isAdmin: true }),
}))

const mockAddCollage = vi.fn().mockResolvedValue('collage-1')
let mockCollages = []
vi.mock('../hooks/useCollages', () => ({
  useCollages: () => ({
    collages: mockCollages,
    loading: false,
    addCollage: mockAddCollage,
    deleteCollage: vi.fn(),
  }),
}))

vi.mock('../hooks/useMemoryPhotos', () => ({
  useMemoryPhotos: () => ({ photos: [], loading: false }),
}))

const mockAddMemory = vi.fn().mockResolvedValue('memory-1')
vi.mock('../hooks/useMemories', () => ({
  useMemoryWriter: () => ({ addMemory: mockAddMemory }),
}))

const mockExportCollage = vi.fn()
vi.mock('../utils/collageRenderer', async (importOriginal) => ({
  ...(await importOriginal()),
  exportCollage: (...args) => mockExportCollage(...args),
}))

vi.mock('../components/media/EncryptedImage', () => ({
  default: ({ alt, className }) => <img alt={alt} className={className} />,
}))

// The real form uploads and encrypts; here it only has to show what it was
// handed and pass a memory back through onSave.
vi.mock('../components/admin/PostMemoryModal', () => ({
  default: ({ defaults, initialFiles, onSave, onClose }) => (
    <div role="dialog">
      <span>{defaults?.title}</span>
      <span>{initialFiles?.map((f) => f.name).join(',')}</span>
      <button onClick={async () => { await onSave({ title: defaults.title, images: ['collage.enc'] }); onClose() }}>
        Post memory
      </button>
    </div>
  ),
}))

// The page's chrome pulls in the router and the whole nav tree; neither is what
// this test is about.
vi.mock('../components/layout/Sidebar', () => ({ default: () => null }))
vi.mock('../components/layout/MobileHeader', () => ({ default: () => null }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))

const { COLLAGE_TEMPLATES, makeCollageDoc, getTemplate } = await import('../components/collage/collageTemplates')
const CollagesPage = (await import('../pages/CollagesPage')).default

describe('CollagesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCollages = []
  })

  // The gallery shows the artwork and nothing else — the template name is
  // carried by the button's accessible name, so it has to stay correct even
  // though no caption is on screen to catch a regression by eye.
  it('names every template card for assistive technology', () => {
    render(<CollagesPage />)
    const names = screen.getAllByRole('button').map((button) => button.textContent)
    expect(names).toHaveLength(COLLAGE_TEMPLATES.length)
    expect(names).toContain('Daisies')
    expect(names).toContain('Story')
    expect(names.every(Boolean)).toBe(true)
  })

  it('leads with the gallery title and the pick-a-template prompt', () => {
    render(<CollagesPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Collages' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Select a template' })).toBeInTheDocument()
  })

  it('creates a collage from the template that was tapped', async () => {
    const user = userEvent.setup()
    render(<CollagesPage />)

    await user.click(screen.getByRole('button', { name: 'Daisies' }))

    expect(mockAddCollage).toHaveBeenCalledTimes(1)
    expect(mockAddCollage.mock.calls[0][0].templateId).toBe('daisy-field')
  })

  it('turns a saved collage into a memory from its card', async () => {
    const user = userEvent.setup()
    const doc = makeCollageDoc(getTemplate('mint-four'))
    doc.slots[0] = { ...doc.slots[0], url: 'beach.enc' }
    mockCollages = [{ id: 'c1', title: 'Summer wall', doc }]
    mockExportCollage.mockResolvedValue(new Blob(['jpg'], { type: 'image/jpeg' }))
    render(<CollagesPage />)

    await user.click(screen.getByRole('button', { name: 'Create memory' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Summer wall')
    expect(dialog).toHaveTextContent('collage.jpg')
    expect(mockExportCollage.mock.calls[0][0]).toBe(doc)

    await user.click(screen.getByText('Post memory'))
    await waitFor(() => expect(mockAddMemory).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Summer wall', images: ['collage.enc'] })
    ))
    expect(mockNavigate).toHaveBeenCalledWith('/home')
  })

  it('offers no memory button on a collage without photos', () => {
    mockCollages = [{ id: 'c1', title: 'Empty', doc: makeCollageDoc(getTemplate('mint-four')) }]
    render(<CollagesPage />)
    expect(screen.queryByRole('button', { name: 'Create memory' })).not.toBeInTheDocument()
  })
})
