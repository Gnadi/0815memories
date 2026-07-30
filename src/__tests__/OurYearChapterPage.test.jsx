import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { emptyKeepsakes } from '../utils/ourYear'

vi.mock('../config/firebase', () => ({ db: null, auth: null, messaging: null }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  doc: vi.fn(),
  addDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(),
  arrayUnion: vi.fn(),
  serverTimestamp: vi.fn(),
  Timestamp: { fromDate: vi.fn() },
}))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: true,
    familyId: 'test-family',
    user: { uid: 'uid-a' },
    encryptionKey: null,
    isAuthenticated: true,
  }),
}))
vi.mock('../components/media/EncryptedImage', () => ({
  default: ({ alt, className }) => <img alt={alt} className={className} />,
}))
vi.mock('../components/layout/Sidebar', () => ({ default: () => <div data-testid="sidebar" /> }))
vi.mock('../components/layout/MobileHeader', () => ({
  default: () => <div data-testid="mobile-header" />,
}))

const mockUseRitual = vi.fn()
const mockUseChapter = vi.fn()
const mockUseChapters = vi.fn()
const mockUseEntries = vi.fn()
const mockUseLetter = vi.fn()

vi.mock('../hooks/useOurYear', () => ({
  useOurYearRitual: (...a) => mockUseRitual(...a),
  useOurYearChapter: (...a) => mockUseChapter(...a),
  useOurYearChapters: (...a) => mockUseChapters(...a),
  useOurYearEntries: (...a) => mockUseEntries(...a),
  useOurYearLetter: (...a) => mockUseLetter(...a),
}))

const RITUAL = {
  id: 'ritual-1',
  familyId: 'test-family',
  participantUids: ['uid-a', 'uid-b'],
  partners: [
    { uid: 'uid-a', name: 'Lena' },
    { uid: 'uid-b', name: 'Jonas' },
  ],
  occasionKey: 'firstMet',
  rhythm: 'manual',
}

function chapter(overrides = {}) {
  return {
    id: 'chapter-1',
    familyId: 'test-family',
    ritualId: 'ritual-1',
    participantUids: ['uid-a', 'uid-b'],
    title: 'A year full of changes',
    status: 'open',
    periodStart: new Date(2025, 4, 13),
    periodEnd: new Date(2026, 4, 12),
    reflectionSubmittedBy: [],
    quizSubmittedBy: [],
    reflectionsRevealedAt: null,
    quizRevealedAt: null,
    quizQuestions: [{ id: 'trip', presetKey: 'trip' }],
    quizReactions: {},
    keepsakes: emptyKeepsakes(),
    letterStatus: 'none',
    letterOpenAt: null,
    ...overrides,
  }
}

const entries = (overrides = {}) => ({
  own: null,
  partner: null,
  loading: false,
  revealed: false,
  saveDraft: vi.fn(),
  submit: vi.fn(),
  ...overrides,
})

let OurYearChapterPage

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/our-year/chapter-1']}>
      <Routes>
        <Route path="/our-year/:chapterId" element={<OurYearChapterPage />} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(async () => {
  vi.clearAllMocks()
  mockUseRitual.mockReturnValue({ ritual: RITUAL, loading: false })
  mockUseChapters.mockReturnValue({ chapters: [], loading: false, deleteChapter: vi.fn() })
  mockUseChapter.mockReturnValue({
    chapter: chapter(),
    loading: false,
    missing: false,
    updateChapter: vi.fn(),
  })
  mockUseEntries.mockReturnValue(entries())
  mockUseLetter.mockReturnValue({
    letter: null,
    loading: false,
    locked: false,
    saveDraft: vi.fn(),
    seal: vi.fn(),
    open: vi.fn(),
  })
  OurYearChapterPage = (await import('../pages/OurYearChapterPage')).default
})

describe('OurYearChapterPage', () => {
  it('shows all four parts plus the closing summary for an open chapter', () => {
    renderPage()

    // The title shows in the header and again in the closing summary.
    expect(screen.getAllByText('A year full of changes').length).toBeGreaterThan(0)
    expect(screen.getAllByText('May 2025 – May 2026').length).toBeGreaterThan(0)
    expect(screen.getByText('Looking back on our time together')).toBeInTheDocument()
    expect(screen.getByText("Our couple's quiz")).toBeInTheDocument()
    expect(screen.getByText('A letter to our future selves')).toBeInTheDocument()
    expect(
      screen.getByText('One picture, one song, one sentence, one moment'),
    ).toBeInTheDocument()
    expect(screen.getByText('Before you close this')).toBeInTheDocument()
  })

  it('asks the five questions and promises the answers stay private until both are done', () => {
    renderPage()

    expect(screen.getByText('What was your loveliest moment with me?')).toBeInTheDocument()
    expect(screen.getByText('When did you make me laugh hardest this year?')).toBeInTheDocument()
    expect(screen.getByText('What are you grateful to me for right now?')).toBeInTheDocument()
    expect(
      screen.getByText('Until you tap "I\'m done", nobody can see your answers.'),
    ).toBeInTheDocument()
  })

  it('holds your answers back while your partner is still writing', () => {
    mockUseEntries.mockImplementation((_chapter, kind) =>
      kind === 'reflection'
        ? entries({ own: { submitted: true, answers: { moment: 'The evening by the river.' } } })
        : entries(),
    )
    renderPage()

    expect(screen.getByText('Your answers are kept safe')).toBeInTheDocument()
    expect(
      screen.getByText('As soon as Jonas is done, you\'ll see both perspectives side by side.'),
    ).toBeInTheDocument()
    expect(screen.getByText('The evening by the river.')).toBeInTheDocument()
  })

  it('puts both perspectives next to each other once they are revealed', () => {
    mockUseChapter.mockReturnValue({
      chapter: chapter({
        reflectionSubmittedBy: ['uid-a', 'uid-b'],
        reflectionsRevealedAt: new Date(2026, 4, 12),
      }),
      loading: false,
      missing: false,
      updateChapter: vi.fn(),
    })
    mockUseEntries.mockImplementation((_chapter, kind) =>
      kind === 'reflection'
        ? entries({
            revealed: true,
            own: { answers: { moment: 'The evening by the river.' } },
            partner: { answers: { moment: 'That morning in the kitchen.' } },
          })
        : entries(),
    )
    renderPage()

    expect(screen.getByText('Your two perspectives')).toBeInTheDocument()
    // Both names head a column on each of the five questions.
    expect(screen.getAllByText('Lena')).toHaveLength(5)
    expect(screen.getAllByText('Jonas')).toHaveLength(5)
    expect(screen.getByText('The evening by the river.')).toBeInTheDocument()
    expect(screen.getByText('That morning in the kitchen.')).toBeInTheDocument()
  })

  it('keeps a sealed letter shut and names the day instead', () => {
    mockUseChapter.mockReturnValue({
      chapter: chapter({ letterStatus: 'sealed', letterOpenAt: new Date(2027, 4, 12) }),
      loading: false,
      missing: false,
      updateChapter: vi.fn(),
    })
    mockUseLetter.mockReturnValue({
      letter: null,
      loading: false,
      locked: true,
      saveDraft: vi.fn(),
      seal: vi.fn(),
      open: vi.fn(),
    })
    renderPage()

    expect(screen.getByText('Sealed')).toBeInTheDocument()
    expect(
      screen.getByText('Until then nobody can read it. Not even the two of you.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Seal the letter together')).not.toBeInTheDocument()
  })

  it('lists what is still missing instead of offering to close', () => {
    renderPage()

    expect(screen.getByText('Something is still missing')).toBeInTheDocument()
    expect(
      screen.getByText("Your look back — one of you hasn't handed in yet."),
    ).toBeInTheDocument()
    expect(
      screen.getByText('The letter to your future selves isn\'t sealed yet.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Close this chapter together')).not.toBeInTheDocument()
  })

  it('renders a closed chapter read-only, with no way to edit or discard it', () => {
    mockUseChapter.mockReturnValue({
      chapter: chapter({
        status: 'closed',
        closedAt: new Date(2026, 4, 12),
        reflectionsRevealedAt: new Date(2026, 4, 12),
        quizRevealedAt: new Date(2026, 4, 12),
        letterStatus: 'sealed',
        letterOpenAt: new Date(2027, 4, 12),
        keepsakes: {
          ...emptyKeepsakes(),
          quote: 'We will manage.',
          song: { title: 'Ein Lied', artist: 'Jemand', link: '' },
        },
      }),
      loading: false,
      missing: false,
      updateChapter: vi.fn(),
    })
    mockUseLetter.mockReturnValue({
      letter: null,
      loading: false,
      locked: true,
      saveDraft: vi.fn(),
      seal: vi.fn(),
      open: vi.fn(),
    })
    renderPage()

    expect(screen.getByText('This chapter is complete')).toBeInTheDocument()
    expect(
      screen.getByText('This chapter is complete and stays exactly as you left it.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Discard chapter')).not.toBeInTheDocument()
    expect(screen.queryByText('Save keepsakes')).not.toBeInTheDocument()
    expect(screen.getAllByText('We will manage.').length).toBeGreaterThan(0)
  })

  it('reports a chapter that is gone', () => {
    mockUseChapter.mockReturnValue({
      chapter: null,
      loading: false,
      missing: true,
      updateChapter: vi.fn(),
    })
    renderPage()

    expect(screen.getByText('This chapter no longer exists.')).toBeInTheDocument()
  })
})
