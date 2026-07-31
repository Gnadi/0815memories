import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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
const mockUseChapters = vi.fn()
vi.mock('../hooks/useOurYear', () => ({
  useOurYearRitual: (...args) => mockUseRitual(...args),
  useOurYearChapters: (...args) => mockUseChapters(...args),
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
  rhythm: 'recurring',
  anchorMonth: 5,
  anchorDay: 12,
}

function chapter(overrides = {}) {
  return {
    id: 'chapter-1',
    title: 'Our year 2025/2026',
    participantUids: ['uid-a', 'uid-b'],
    status: 'closed',
    periodStart: new Date(2025, 4, 13),
    periodEnd: new Date(2026, 4, 12),
    keepsakes: {
      ...emptyKeepsakes(),
      song: { title: 'Ein Lied', artist: 'Jemand', link: '' },
      quote: 'We will manage.',
      moment: 'That evening by the river.',
    },
    letterStatus: 'none',
    letterOpenAt: null,
    ...overrides,
  }
}

let OurYearPage

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/our-year']}>
      <OurYearPage />
    </MemoryRouter>,
  )

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 5, 1, 12, 0, 0))
})
afterAll(() => {
  vi.useRealTimers()
})

beforeEach(async () => {
  vi.clearAllMocks()
  mockUseRitual.mockReturnValue({ ritual: RITUAL, loading: false })
  mockUseChapters.mockReturnValue({ chapters: [], loading: false, addChapter: vi.fn() })
  OurYearPage = (await import('../pages/OurYearPage')).default
})

describe('OurYearPage', () => {
  it('invites an admin without a ritual to set up their own, and shows nothing else', () => {
    mockUseRitual.mockReturnValue({ ritual: null, loading: false })
    renderPage()

    expect(screen.getByText('There is nothing here for you yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set up our ritual' })).toBeInTheDocument()
    expect(screen.queryByText('Our chapters')).not.toBeInTheDocument()
  })

  it('shows the couple\'s occasion and next date without pressuring them', () => {
    renderPage()

    expect(screen.getByText('The day we met')).toBeInTheDocument()
    expect(screen.getByText(/12 May|May 12/)).toBeInTheDocument()
    expect(
      screen.getByText('This is only a reminder — you can start a chapter whenever you want.'),
    ).toBeInTheDocument()
  })

  it('offers a first chapter when the timeline is still empty', () => {
    renderPage()

    expect(screen.getByText('No chapter yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Start the first chapter/ })).toBeInTheDocument()
  })

  it('lists chapters with their period and keepsakes', () => {
    mockUseChapters.mockReturnValue({
      chapters: [chapter()],
      loading: false,
      addChapter: vi.fn(),
    })
    renderPage()

    expect(screen.getByText('Our year 2025/2026')).toBeInTheDocument()
    expect(screen.getByText('May 2025 – May 2026')).toBeInTheDocument()
    expect(screen.getByText('Ein Lied · Jemand')).toBeInTheDocument()
    expect(screen.getByText('We will manage.')).toBeInTheDocument()
    expect(screen.getByText('1 chapter')).toBeInTheDocument()
  })

  it('announces a sealed letter whose day has come', () => {
    mockUseChapters.mockReturnValue({
      chapters: [
        chapter({ letterStatus: 'sealed', letterOpenAt: new Date(2026, 4, 12) }),
      ],
      loading: false,
      addChapter: vi.fn(),
    })
    renderPage()

    expect(screen.getByText('A letter from us is waiting for us.')).toBeInTheDocument()
    expect(screen.getByText('A letter is waiting')).toBeInTheDocument()
  })

  it('keeps a still-sealed letter closed, showing only the date', () => {
    mockUseChapters.mockReturnValue({
      chapters: [
        chapter({ letterStatus: 'sealed', letterOpenAt: new Date(2027, 4, 12) }),
      ],
      loading: false,
      addChapter: vi.fn(),
    })
    renderPage()

    expect(screen.queryByText('A letter from us is waiting for us.')).not.toBeInTheDocument()
    expect(screen.getByText(/Letter sealed until/)).toBeInTheDocument()
  })
})
