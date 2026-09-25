import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Mocks — declared before the page under test is imported
// ---------------------------------------------------------------------------

vi.mock('../config/firebase', () => ({ db: {}, auth: null, messaging: null }))

const mockGetDoc = vi.fn()
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, collection, id) => ({ collection, id })),
  getDoc: (...args) => mockGetDoc(...args),
  Timestamp: { now: () => ({ seconds: 0 }) },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ familyId: 'test-family', encryptionKey: null, isAuthenticated: true, isAdmin: true }),
}))

const mockUpdateCollage = vi.fn().mockResolvedValue(undefined)
vi.mock('../hooks/useCollages', () => ({
  useCollageWriter: () => ({
    updateCollage: mockUpdateCollage,
    deleteCollage: vi.fn(),
    addCollage: vi.fn(),
  }),
  decryptCollage: async (_key, data) => data,
}))

const mockAddMemory = vi.fn().mockResolvedValue('memory-1')
vi.mock('../hooks/useMemories', () => ({
  useMemoryWriter: () => ({ addMemory: mockAddMemory, updateMemory: vi.fn(), deleteMemory: vi.fn() }),
}))

const mockExportCollage = vi.fn()
vi.mock('../utils/collageRenderer', async (importOriginal) => ({
  ...(await importOriginal()),
  exportCollage: (...args) => mockExportCollage(...args),
}))

// The real form uploads and encrypts; here it only has to show what it was
// handed and pass a memory back through onSave.
vi.mock('../components/admin/PostMemoryModal', () => ({
  default: ({ defaults, initialFiles, onSave, onClose }) => (
    <div role="dialog">
      <span>{defaults?.title}</span>
      <span>{defaults?.category}</span>
      <span>{initialFiles?.map((f) => f.name).join(',')}</span>
      <button onClick={async () => { await onSave({ title: defaults.title, images: ['collage.enc'] }); onClose() }}>
        Post memory
      </button>
    </div>
  ),
}))

vi.mock('../hooks/useMemoryPhotos', () => ({
  useMemoryPhotos: () => ({
    photos: [
      { id: 'm1:0', url: 'beach.enc', thumbUrl: 'beach-thumb.enc', memoryId: 'm1', memoryTitle: 'Beach day', date: new Date(2026, 6, 1) },
      { id: 'm2:0', url: 'hike.enc', thumbUrl: '', memoryId: 'm2', memoryTitle: 'Mountain hike', date: new Date(2026, 5, 1) },
    ],
    loading: false,
  }),
}))

vi.mock('../hooks/useScrapbookPhotoUpload', () => ({
  useScrapbookPhotoUpload: () => ({ upload: vi.fn(), uploading: false, session: [] }),
}))

vi.mock('../components/media/EncryptedImage', () => ({
  default: ({ alt, className }) => <img alt={alt} className={className} />,
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'collage-1' }),
  useNavigate: () => mockNavigate,
}))

// The canvas preview needs no pixels here: jsdom reports a zero-width layout, so
// the renderer bails before it ever asks for a 2D context.
const { makeCollageDoc, getTemplate, COLLAGE_TEMPLATES } = await import('../components/collage/collageTemplates')
const CollageEditorPage = (await import('../pages/CollageEditorPage')).default

const savedDoc = () => mockUpdateCollage.mock.calls.at(-1)[1].doc

function mockCollage(templateId = 'mint-four') {
  mockGetDoc.mockResolvedValue({
    exists: () => true,
    id: 'collage-1',
    data: () => ({
      familyId: 'test-family',
      title: 'Summer wall',
      templateId,
      doc: makeCollageDoc(getTemplate(templateId)),
    }),
  })
}

async function renderEditor(templateId) {
  mockCollage(templateId)
  render(<CollageEditorPage />)
  await waitFor(() => expect(screen.getByDisplayValue('Summer wall')).toBeInTheDocument())
}

describe('CollageEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows one empty slot per template slot', async () => {
    await renderEditor('mint-four')
    expect(screen.getAllByLabelText('Add a photo here')).toHaveLength(4)
    expect(screen.queryAllByLabelText('Select this photo')).toHaveLength(0)
  })

  it('fills the slot the customer tapped with the photo they picked', async () => {
    const user = userEvent.setup()
    await renderEditor('mint-four')

    await user.click(screen.getAllByLabelText('Add a photo here')[1])
    // The photo strip opens on the memories library.
    expect(screen.getByTitle('Beach day')).toBeInTheDocument()

    await user.click(screen.getByTitle('Beach day'))

    expect(screen.getAllByLabelText('Add a photo here')).toHaveLength(3)
    expect(screen.getAllByLabelText('Select this photo')).toHaveLength(1)

    await user.click(screen.getByText('Save'))
    await waitFor(() => expect(mockUpdateCollage).toHaveBeenCalled())
    // Second slot, because that is the one that was tapped.
    expect(savedDoc().slots.map((s) => s.url)).toEqual([null, 'beach.enc', null, null])
    expect(savedDoc().slots[1].thumbUrl).toBe('beach-thumb.enc')
  })

  it('keeps the placed photos when the template changes', async () => {
    const user = userEvent.setup()
    await renderEditor('mint-four')

    await user.click(screen.getAllByLabelText('Add a photo here')[0])
    await user.click(screen.getByTitle('Beach day'))

    // The template strip carries every template; switch to the single-slot one.
    const target = COLLAGE_TEMPLATES.find((tpl) => tpl.id === 'daisy-field')
    await user.click(screen.getByText('Daisies'))

    expect(screen.getAllByLabelText('Select this photo')).toHaveLength(1)
    expect(screen.queryAllByLabelText('Add a photo here')).toHaveLength(target.slots.length - 1)

    await user.click(screen.getByText('Save'))
    await waitFor(() => expect(mockUpdateCollage).toHaveBeenCalled())
    expect(savedDoc().templateId).toBe('daisy-field')
    expect(savedDoc().slots[0].url).toBe('beach.enc')
  })

  it('saves the border and background chosen in the Borders tab', async () => {
    const user = userEvent.setup()
    await renderEditor('mint-four')

    await user.click(screen.getByText('Borders'))
    await user.click(screen.getAllByLabelText('Frame colour')[2])
    await user.click(screen.getAllByLabelText('Background')[3])

    await user.click(screen.getByText('Save'))
    await waitFor(() => expect(mockUpdateCollage).toHaveBeenCalled())

    expect(savedDoc().border.color).toBe('#2D1B0E')
    // Picking a frame colour also gives it a visible thickness.
    expect(savedDoc().border.width).toBeGreaterThan(0)
    expect(savedDoc().background).toBe('#A8C7FA')
  })

  it('writes the pending change out when the editor is closed', async () => {
    const user = userEvent.setup()
    await renderEditor('mint-four')

    // Autosave is debounced by two seconds; closing straight away used to drop
    // whatever had just been placed.
    await user.click(screen.getAllByLabelText('Add a photo here')[0])
    await user.click(screen.getByTitle('Beach day'))
    await user.click(screen.getByLabelText('Close'))

    await waitFor(() => expect(mockUpdateCollage).toHaveBeenCalled())
    expect(savedDoc().slots[0].url).toBe('beach.enc')
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/collages'))
  })

  it('does not write anything when nothing changed', async () => {
    const user = userEvent.setup()
    await renderEditor('mint-four')

    await user.click(screen.getByLabelText('Close'))

    expect(mockUpdateCollage).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/collages')
  })

  it('opens the memory form with the rendered collage as its photo', async () => {
    const user = userEvent.setup()
    mockExportCollage.mockResolvedValue(new Blob(['jpg'], { type: 'image/jpeg' }))
    await renderEditor('mint-four')

    await user.click(screen.getAllByLabelText('Add a photo here')[0])
    await user.click(screen.getByTitle('Beach day'))
    await user.click(screen.getByLabelText('More options'))
    await user.click(screen.getByText('Create memory'))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Summer wall')
    expect(dialog).toHaveTextContent('collage.jpg')
    // The pending edit is written first, so the memory matches the saved collage.
    expect(mockUpdateCollage).toHaveBeenCalled()
    expect(mockExportCollage.mock.calls[0][0].slots[0].url).toBe('beach.enc')

    await user.click(screen.getByText('Post memory'))
    await waitFor(() => expect(mockAddMemory).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Summer wall', images: ['collage.enc'] })
    ))
    expect(mockNavigate).toHaveBeenCalledWith('/home')
  })

  it('does not offer a memory for an empty collage', async () => {
    const user = userEvent.setup()
    await renderEditor('mint-four')

    await user.click(screen.getByLabelText('More options'))
    expect(screen.getByText('Create memory').closest('button')).toBeDisabled()
  })

  it('reports a collage belonging to another family as not found', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'collage-1',
      data: () => ({ familyId: 'someone-else', doc: makeCollageDoc(getTemplate()) }),
    })
    render(<CollageEditorPage />)
    await waitFor(() =>
      expect(screen.getByText('This creation could not be found.')).toBeInTheDocument()
    )
  })
})
