import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { memoryFormToMomentDraft, momentFormToMemoryDraft } from '../utils/entryConversion'

vi.mock('../config/firebase', () => ({ db: {}, auth: null, messaging: null }))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ familyId: 'fam', encryptionKey: null }),
}))

vi.mock('../components/media/EncryptedImage', () => ({ default: () => <img alt="" /> }))
vi.mock('../components/media/EncryptedVideo', () => ({ default: () => <video /> }))

const mockAddMemory = vi.fn()
const mockAddMoment = vi.fn()
const mockToMoment = vi.fn().mockResolvedValue('moment-new')
const mockToMemory = vi.fn().mockResolvedValue('memory-new')
vi.mock('../hooks/useMemories', () => ({
  useMemoryWriter: () => ({ addMemory: mockAddMemory }),
  useMomentWriter: () => ({ addMoment: mockAddMoment }),
  useEntryConverter: () => ({
    convertMemoryToMoment: mockToMoment,
    convertMomentToMemory: mockToMemory,
  }),
}))

// Stand-ins for the two forms: they show what they were opened with, and offer
// the switch and a save the way the real ones do.
vi.mock('../components/admin/PostMemoryModal', () => ({
  default: ({ memory, draft, converting, onSave, onClose, onSwitchType }) => (
    <div data-testid="memory-modal">
      <span>{memory ? `editing:${memory.id}` : `draft:${draft?.title ?? ''}`}</span>
      {converting && <span>converting</span>}
      <button onClick={() => onSwitchType({ caption: 'From memory', images: ['a.enc'] })}>to moment</button>
      <button onClick={async () => { await onSave(...(memory ? [memory.id, { title: 'T' }] : [{ title: 'T' }])); onClose() }}>save</button>
    </div>
  ),
}))
vi.mock('../components/admin/PostMomentModal', () => ({
  default: ({ moment, draft, converting, onSave, onClose, onSwitchType }) => (
    <div data-testid="moment-modal">
      <span>{moment ? `editing:${moment.id}` : `draft:${draft?.caption ?? ''}`}</span>
      {converting && <span>converting</span>}
      <button onClick={() => onSwitchType({ title: 'From moment', images: ['b.enc'] })}>to memory</button>
      <button onClick={async () => { await onSave(...(moment ? [moment.id, { caption: 'C' }] : [{ caption: 'C' }])); onClose() }}>save</button>
    </div>
  ),
}))

const PostEntryModal = (await import('../components/admin/PostEntryModal')).default

describe('memory / moment drafts', () => {
  const images = [
    { url: 'one.enc', thumbUrl: 'one-t.enc' },
    { url: '', uploading: true },
  ]
  const videos = [{ url: 'v.enc', publicId: 'v1', title: 'Clip' }]

  it('folds a memory title and story into the moment caption and keeps the media', () => {
    const draft = memoryFormToMomentDraft({
      form: { title: 'Beach day', category: 'Family', location: 'Lido' },
      storyText: 'We built a castle.',
      images,
      videos,
    })
    expect(draft).toEqual({
      caption: 'Beach day\n\nWe built a castle.',
      category: 'Family',
      location: 'Lido',
      label: '',
      images: ['one.enc'],
      thumbs: ['one-t.enc'],
      videos: [{ url: 'v.enc', publicId: 'v1', title: 'Clip' }],
    })
  })

  it('splits a moment caption into a memory title and story, keeping its date', () => {
    const date = { seconds: 1700000000 }
    const draft = momentFormToMemoryDraft({
      form: { caption: 'First steps!\nShe walked to the sofa.', category: '', location: 'Home' },
      images: [{ url: 'x.enc' }],
      videos: [],
      date,
    })
    expect(draft).toMatchObject({
      title: 'First steps!',
      content: 'She walked to the sofa.',
      location: 'Home',
      date,
      images: ['x.enc'],
      videos: [],
    })
    expect(draft).not.toHaveProperty('thumbs')
  })
})

describe('PostEntryModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('converts an edited memory into a moment, keeping the memory date', async () => {
    const onSave = vi.fn()
    const onConverted = vi.fn()
    const onClose = vi.fn()
    const memory = { id: 'm1', title: 'Old', date: { seconds: 5 } }
    render(
      <PostEntryModal type="memory" entry={memory} onSave={onSave} onConverted={onConverted} onClose={onClose} />
    )
    expect(screen.getByText('editing:m1')).toBeInTheDocument()

    await userEvent.click(screen.getByText('to moment'))
    expect(screen.getByTestId('moment-modal')).toBeInTheDocument()
    expect(screen.getByText('draft:From memory')).toBeInTheDocument()
    expect(screen.getByText('converting')).toBeInTheDocument()

    await userEvent.click(screen.getByText('save'))
    expect(mockToMoment).toHaveBeenCalledWith('m1', { caption: 'C' }, { seconds: 5 })
    expect(onConverted).toHaveBeenCalledWith('moment', 'moment-new')
    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('switching back while editing returns to the original entry', async () => {
    render(<PostEntryModal type="moment" entry={{ id: 'x' }} onSave={vi.fn()} onClose={vi.fn()} />)
    await userEvent.click(screen.getByText('to memory'))
    expect(screen.getByText('draft:From moment')).toBeInTheDocument()
    await userEvent.click(screen.getByText('to moment'))
    expect(screen.getByText('editing:x')).toBeInTheDocument()
    expect(screen.queryByText('converting')).not.toBeInTheDocument()
  })

  it('converts an edited moment into a memory', async () => {
    const onConverted = vi.fn()
    render(<PostEntryModal type="moment" entry={{ id: 'mo1' }} onSave={vi.fn()} onConverted={onConverted} onClose={vi.fn()} />)
    await userEvent.click(screen.getByText('to memory'))
    await userEvent.click(screen.getByText('save'))
    expect(mockToMemory).toHaveBeenCalledWith('mo1', { title: 'T' })
    expect(onConverted).toHaveBeenCalledWith('memory', 'memory-new')
  })

  it('a new memory switched to a moment is posted as a new moment', async () => {
    const onSave = vi.fn()
    render(<PostEntryModal type="memory" onSave={onSave} onClose={vi.fn()} />)
    await userEvent.click(screen.getByText('to moment'))
    expect(screen.queryByText('converting')).not.toBeInTheDocument()
    await userEvent.click(screen.getByText('save'))
    expect(mockAddMoment).toHaveBeenCalledWith({ caption: 'C' })
    expect(mockToMoment).not.toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })
})
