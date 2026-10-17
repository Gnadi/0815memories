/* Writing a journal entry: in the rich editor or in Markdown, and editing an
   entry from before either without losing its text, its attachments or its
   date. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../config/firebase', () => ({ db: {}, auth: null, messaging: null }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ familyId: 'fam1', encryptionKey: null, isAuthenticated: true, isAdmin: true }),
}))
vi.mock('../hooks/useKids', () => ({ useKids: () => ({ kids: [{ id: 'kid1', name: 'Emma' }] }) }))

let mockJournals = []
const mockAddJournal = vi.fn()
const mockUpdateJournal = vi.fn()
vi.mock('../hooks/useJournals', () => ({
  useJournals: () => ({
    journals: mockJournals, loading: false, addJournal: mockAddJournal, updateJournal: mockUpdateJournal,
  }),
}))

let mockParams = {}
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, useParams: () => mockParams }))

vi.mock('../components/media/EncryptedImage', () => ({ default: () => null }))
vi.mock('../components/media/EncryptedVideo', () => ({ default: () => null }))
vi.mock('../components/admin/VoiceMemoRecorder', () => ({ default: () => null }))
// The editor itself is TipTap's and has tests of its own; here it only has to
// show what it was given and hand back a document.
vi.mock('../components/admin/RichTextEditorLazy', () => ({
  default: ({ value, onChange, media }) => (
    <div data-testid="rich-editor" data-media={String(media)}>
      <span>{JSON.stringify(value)}</span>
      <button
        type="button"
        onClick={() => onChange({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi', marks: [{ type: 'bold' }] }] }] })}
      >
        type
      </button>
    </div>
  ),
}))

const JournalEntryPage = (await import('../pages/JournalEntryPage')).default

const legacyEntry = {
  id: 'e1',
  title: 'First tooth',
  volume: 'Volume 1',
  content: 'At dinner.',
  emotion: 'pride',
  date: { seconds: Date.UTC(2024, 9, 18) / 1000 },
  photos: ['https://example.test/a'],
  videos: [],
  voiceMemos: [{ url: 'https://example.test/v', title: 'Hello' }],
}

beforeEach(() => {
  mockParams = { childId: 'kid1' }
  mockJournals = []
  mockAddJournal.mockReset().mockResolvedValue()
  mockUpdateJournal.mockReset().mockResolvedValue()
  mockNavigate.mockReset()
})

const saveButtons = () => screen.getAllByRole('button', { name: 'Save' })

describe('a new entry', () => {
  it('is written in the rich editor, without media, and saved with its plain-text mirror', async () => {
    const user = userEvent.setup()
    render(<JournalEntryPage />)
    expect(screen.getByTestId('rich-editor')).toHaveAttribute('data-media', 'false')
    saveButtons().forEach((b) => expect(b).toBeDisabled())

    await user.click(screen.getByRole('button', { name: 'type' }))
    await user.click(saveButtons()[0])

    await waitFor(() => expect(mockAddJournal).toHaveBeenCalled())
    expect(mockAddJournal.mock.calls[0][0]).toMatchObject({
      contentFormat: 'rich',
      content: 'Hi',
      contentRich: { type: 'doc' },
      emotion: 'love',
    })
  })

  it('can be written in Markdown instead', async () => {
    const user = userEvent.setup()
    render(<JournalEntryPage />)
    await user.click(screen.getByRole('radio', { name: 'Markdown' }))
    await user.type(screen.getByRole('textbox', { name: 'Your letter' }), 'You were **brave**')
    await user.click(screen.getByRole('button', { name: /Joy/ }))
    await user.click(saveButtons()[1])

    await waitFor(() => expect(mockAddJournal).toHaveBeenCalled())
    expect(mockAddJournal.mock.calls[0][0]).toMatchObject({
      contentFormat: 'markdown', content: 'You were **brave**', contentRich: null, emotion: 'joy',
    })
  })
})

describe('an entry from before the editor', () => {
  it('opens with its text in the editor and keeps everything else when saved', async () => {
    mockParams = { childId: 'kid1', entryId: 'e1' }
    mockJournals = [legacyEntry]
    const user = userEvent.setup()
    render(<JournalEntryPage />)

    const editor = await screen.findByTestId('rich-editor')
    expect(within(editor).getByText(/At dinner\./)).toBeInTheDocument()
    expect(screen.getByDisplayValue('First tooth')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2024-10-18')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Update' })[0])

    await waitFor(() => expect(mockUpdateJournal).toHaveBeenCalled())
    const [id, data] = mockUpdateJournal.mock.calls[0]
    expect(id).toBe('e1')
    expect(data).toMatchObject({
      title: 'First tooth',
      volume: 'Volume 1',
      emotion: 'pride',
      content: 'At dinner.',
      contentFormat: 'rich',
      photos: ['https://example.test/a'],
      voiceMemos: [{ url: 'https://example.test/v', title: 'Hello' }],
    })
    expect(data.date.toDate().toISOString()).toBe('2024-10-18T00:00:00.000Z')
  })
})
