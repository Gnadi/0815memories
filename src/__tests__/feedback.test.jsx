/**
 * The feedback form and the document it produces.
 *
 * Two things are worth pinning down here. First, the document shape: the
 * security rule for /feedback rejects anything outside src/constants/feedback.js
 * field for field, so a form that sends an oversized path or a stray key fails
 * the write with a permission error that reads to the person as "your feedback
 * was rejected". Second, that a *viewer* can send it — everywhere else in the
 * app a viewer only reads, and it would be easy to gate this the same way by
 * reflex.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  buildFeedbackDocument,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_PATH_MAX,
  FEEDBACK_CONTACT_MAX,
} from '../constants/feedback'

vi.mock('../config/firebase', () => ({ db: {}, auth: null, messaging: null }))

const mockAuth = { familyId: 'test-family', user: { uid: 'uid-1', email: 'me@example.com' }, isViewer: false }
vi.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }))

vi.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/home' }) }))

const mockAddDoc = vi.fn().mockResolvedValue({ id: 'feedback-1' })
vi.mock('firebase/firestore', () => ({
  addDoc: (...args) => mockAddDoc(...args),
  collection: (_db, name) => ({ name }),
  serverTimestamp: () => 'SERVER_TIMESTAMP',
}))

const mockSubmit = vi.fn().mockResolvedValue(undefined)
vi.mock('../hooks/useFeedback', () => ({
  useFeedbackWriter: (...args) => {
    mockWriterArgs.push(args)
    return { submitFeedback: mockSubmit }
  },
}))
const mockWriterArgs = []

const FeedbackModal = (await import('../components/FeedbackModal')).default

describe('buildFeedbackDocument', () => {
  it('trims the message and keeps the chosen category and rating', () => {
    const built = buildFeedbackDocument({ message: '  the timeline is slow  ', category: 'bug', rating: 2 })
    expect(built.ok).toBe(true)
    expect(built.value.message).toBe('the timeline is slow')
    expect(built.value.category).toBe('bug')
    expect(built.value.rating).toBe(2)
  })

  it('refuses a message that is only whitespace', () => {
    expect(buildFeedbackDocument({ message: '   ' })).toEqual({ ok: false, error: 'errors.messageRequired' })
    expect(buildFeedbackDocument({})).toEqual({ ok: false, error: 'errors.messageRequired' })
  })

  it('refuses a message past the limit the rules enforce', () => {
    const built = buildFeedbackDocument({ message: 'x'.repeat(FEEDBACK_MESSAGE_MAX + 1) })
    expect(built).toEqual({ ok: false, error: 'errors.messageTooLong' })
    expect(buildFeedbackDocument({ message: 'x'.repeat(FEEDBACK_MESSAGE_MAX) }).ok).toBe(true)
  })

  it('refuses a contact address past the limit', () => {
    const contact = `${'x'.repeat(FEEDBACK_CONTACT_MAX)}@example.com`
    expect(buildFeedbackDocument({ message: 'hi', contact })).toEqual({ ok: false, error: 'errors.contactTooLong' })
  })

  it('falls back to "other" for a category nobody offered', () => {
    expect(buildFeedbackDocument({ message: 'hi', category: 'urgent' }).value.category).toBe('other')
    expect(buildFeedbackDocument({ message: 'hi' }).value.category).toBe('other')
  })

  // 0 is what the star row holds before anyone touches it, and it must not
  // reach the document as a rating of zero — the rules only accept 1..5.
  it('stores no rating rather than a zero or an out-of-range one', () => {
    for (const rating of [0, -1, 6, 2.5, '3', null, undefined]) {
      expect(buildFeedbackDocument({ message: 'hi', rating }).value.rating).toBeNull()
    }
  })

  // The browser supplies these three, and a long route or a long user-agent
  // would otherwise be the form's own doing when the write is denied.
  it('truncates the context fields instead of letting the write fail', () => {
    const built = buildFeedbackDocument({
      message: 'hi',
      path: `/${'p'.repeat(FEEDBACK_PATH_MAX * 2)}`,
      language: 'de-DE-with-a-very-long-tag',
      userAgent: 'u'.repeat(1000),
    })
    expect(built.value.path).toHaveLength(FEEDBACK_PATH_MAX)
    expect(built.value.language).toHaveLength(16)
    expect(built.value.userAgent).toHaveLength(300)
  })

  it('emits exactly the keys the security rule allows', () => {
    const built = buildFeedbackDocument({ message: 'hi' })
    expect(Object.keys(built.value).sort()).toEqual(
      ['category', 'contact', 'language', 'message', 'path', 'rating', 'userAgent'].sort()
    )
  })
})

describe('FeedbackModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWriterArgs.length = 0
    mockAuth.isViewer = false
    mockAuth.user = { uid: 'uid-1', email: 'me@example.com' }
  })

  afterEach(cleanup)

  it('cannot be sent empty', () => {
    render(<FeedbackModal onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Send feedback' })).toBeDisabled()
  })

  it('sends the note with the rating, category and the page it was written on', async () => {
    const user = userEvent.setup()
    render(<FeedbackModal onClose={() => {}} />)

    await user.click(screen.getByRole('radio', { name: '4 out of 5 stars' }))
    await user.click(screen.getByRole('button', { name: 'An idea' }))
    await user.type(screen.getByLabelText('Your feedback'), 'A dark mode, please')
    await user.click(screen.getByRole('button', { name: 'Send feedback' }))

    expect(mockSubmit).toHaveBeenCalledTimes(1)
    expect(mockSubmit.mock.calls[0][0]).toMatchObject({
      message: 'A dark mode, please',
      category: 'idea',
      rating: 4,
      path: '/home',
    })
    // Confirmation, not a silently closed dialog.
    expect(await screen.findByText('Thank you')).toBeInTheDocument()
  })

  it('takes the rating back when the lit star is tapped again', async () => {
    const user = userEvent.setup()
    render(<FeedbackModal onClose={() => {}} />)

    const third = screen.getByRole('radio', { name: '3 out of 5 stars' })
    await user.click(third)
    expect(third).toHaveAttribute('aria-checked', 'true')
    await user.click(third)
    expect(third).toHaveAttribute('aria-checked', 'false')

    await user.type(screen.getByLabelText('Your feedback'), 'no stars from me')
    await user.click(screen.getByRole('button', { name: 'Send feedback' }))
    expect(mockSubmit.mock.calls[0][0].rating).toBe(0)
  })

  it('shows the failure and keeps what was written when the send fails', async () => {
    mockSubmit.mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    render(<FeedbackModal onClose={() => {}} />)

    await user.type(screen.getByLabelText('Your feedback'), 'something broke')
    await user.click(screen.getByRole('button', { name: 'Send feedback' }))

    expect(await screen.findByText(/could not be sent/)).toBeInTheDocument()
    expect(screen.getByLabelText('Your feedback')).toHaveValue('something broke')
  })

  // An admin whose claim has not landed yet is not a viewer, and must not be
  // filed as one — which reading isAdmin instead of isViewer would do.
  it('files a pre-claim admin as an admin, not a viewer', () => {
    mockAuth.isViewer = false
    render(<FeedbackModal onClose={() => {}} />)
    expect(mockWriterArgs[0][1].role).toBe('admin')
  })

  it('offers the form to a viewer, signed as a viewer', async () => {
    mockAuth.isViewer = true
    mockAuth.user = { uid: 'uid-viewer', email: null }
    const user = userEvent.setup()
    render(<FeedbackModal onClose={() => {}} />)

    expect(mockWriterArgs[0]).toEqual(['test-family', { uid: 'uid-viewer', role: 'viewer' }])
    // No account email to prefill, and the field stays optional.
    expect(screen.getByLabelText('Email for a reply')).toHaveValue('')

    await user.type(screen.getByLabelText('Your feedback'), 'the photos load slowly')
    await user.click(screen.getByRole('button', { name: 'Send feedback' }))
    expect(mockSubmit).toHaveBeenCalledTimes(1)
  })

  // The launcher lives in the mobile header, which is `sticky ... z-30` — a
  // stacking context. A dialog rendered in place is trapped inside it and the
  // bottom nav (z-40) paints over its send button, whatever z-index the dialog
  // asks for. Only rendering outside that subtree fixes it.
  it('renders outside the subtree it was opened from', () => {
    const { container } = render(<FeedbackModal onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(container).not.toContainElement(dialog)
    expect(document.body).toContainElement(dialog)
  })

  // The complaint that started this: the send button was the last thing in one
  // long scrolling column. It belongs in the pinned footer, outside the region
  // that scrolls, so it is on screen the moment the sheet opens.
  it('keeps the send button out of the scrolling region', () => {
    render(<FeedbackModal onClose={() => {}} />)
    const scrollRegion = screen.getByRole('dialog').querySelector('.overflow-y-auto')
    expect(scrollRegion).not.toBeNull()
    // The fields scroll…
    expect(scrollRegion).toContainElement(screen.getByLabelText('Your feedback'))
    // …the button does not.
    expect(scrollRegion).not.toContainElement(screen.getByRole('button', { name: 'Send feedback' }))
  })

  it('prefills an admin’s account email so a reply can reach them', () => {
    render(<FeedbackModal onClose={() => {}} />)
    expect(screen.getByLabelText('Email for a reply')).toHaveValue('me@example.com')
  })
})

// The real writer, alongside the mocked one the modal uses above.
const { useFeedbackWriter } = await vi.importActual('../hooks/useFeedback')

describe('useFeedbackWriter', () => {
  beforeEach(() => {
    mockAddDoc.mockClear()
  })

  const submit = (input, familyId = 'test-family', identity = { uid: 'uid-1', role: 'admin' }) => {
    let writer
    function Probe() {
      writer = useFeedbackWriter(familyId, identity)
      return null
    }
    render(<Probe />)
    return writer.submitFeedback(input)
  }

  afterEach(cleanup)

  it('writes one document carrying the sender, the family and the server clock', async () => {
    await submit({ message: 'lovely app', category: 'praise', rating: 5 })

    expect(mockAddDoc).toHaveBeenCalledTimes(1)
    const [ref, written] = mockAddDoc.mock.calls[0]
    expect(ref).toEqual({ name: 'feedback' })
    expect(written).toEqual({
      message: 'lovely app',
      category: 'praise',
      rating: 5,
      contact: '',
      path: '',
      language: '',
      userAgent: '',
      familyId: 'test-family',
      uid: 'uid-1',
      role: 'admin',
      status: 'new',
      createdAt: 'SERVER_TIMESTAMP',
    })
  })

  // The modal turns this into the message under the field rather than the
  // generic "could not be sent", so the key has to survive the throw.
  it('rejects an empty note before it reaches Firestore, naming the field', async () => {
    await expect(submit({ message: '  ' })).rejects.toMatchObject({
      translationKey: 'errors.messageRequired',
    })
    expect(mockAddDoc).not.toHaveBeenCalled()
  })

  it('writes nothing when the session has no family', async () => {
    await expect(submit({ message: 'hi' }, null)).rejects.toThrow(/family/i)
    expect(mockAddDoc).not.toHaveBeenCalled()
  })
})
