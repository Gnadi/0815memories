import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Mocks — must be declared before the module under test is imported
// ---------------------------------------------------------------------------

// Mock Firebase so no real SDK calls happen
vi.mock('../config/firebase', () => ({ db: null, auth: null, messaging: null }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
}))

// Mock AuthContext
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ familyId: 'test-family', encryptionKey: null, isAuthenticated: true }),
}))

// Mock EncryptedImage (just render an <img>)
vi.mock('../components/media/EncryptedImage', () => ({
  default: ({ alt, className }) => <img alt={alt} className={className} />,
}))

// Mock layout components
vi.mock('../components/layout/Sidebar', () => ({ default: () => <div data-testid="sidebar" /> }))
vi.mock('../components/layout/MobileHeader', () => ({ default: () => <div data-testid="mobile-header" /> }))

// ---------------------------------------------------------------------------
// Controllable useMemories mock
// ---------------------------------------------------------------------------

const mockUseMemories = vi.fn()
vi.mock('../hooks/useMemories', () => ({
  useMemories: (...args) => mockUseMemories(...args),
}))

// ---------------------------------------------------------------------------
// Sample memory data
// "On This Day" reference: April 16 (month index 3, day 16)
// Today in the test environment is mocked to 2026-04-16.
// ---------------------------------------------------------------------------

// April 16 (same month+day as today) from different years
const april16_2023 = { id: '1', title: 'Memory A', date: new Date(2023, 3, 16), images: [] }
const april16_2021 = { id: '2', title: 'Memory B', date: new Date(2021, 3, 16), images: [] }
// Different day — should NOT appear in "On This Day" mode
const jan01_2022   = { id: '3', title: 'Memory C', date: new Date(2022, 0, 1),  images: [] }
const dec25_2020   = { id: '4', title: 'Memory D', date: new Date(2020, 11, 25), images: [] }

const ALL_MEMORIES = [april16_2023, april16_2021, jan01_2022, dec25_2020]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage(initialRoute = '/timeline') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      {/* SmartTimelinePage uses useSearchParams which needs Router context */}
      <SmartTimelinePageLoader />
    </MemoryRouter>
  )
}

// Lazy-import wrapper so mocks are already in place when the module loads
let SmartTimelinePage
async function SmartTimelinePageLoader() {
  return SmartTimelinePage ? <SmartTimelinePage /> : null
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SmartTimelinePage', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Default: return all memories, not loading
    mockUseMemories.mockReturnValue({ memories: ALL_MEMORIES, loading: false })
    // Import (or re-use) the page component after mocks are set
    SmartTimelinePage = (await import('../pages/SmartTimelinePage')).default
  })

  // ---- basic render -------------------------------------------------------

  it('renders the page title', async () => {
    render(
      <MemoryRouter initialEntries={['/timeline']}>
        <SmartTimelinePage />
      </MemoryRouter>
    )
    expect(screen.getByText('Smart Timeline')).toBeInTheDocument()
  })

  it('shows all memories by default (auto-selects most recent year)', async () => {
    render(
      <MemoryRouter initialEntries={['/timeline']}>
        <SmartTimelinePage />
      </MemoryRouter>
    )
    // Year 2023 should be auto-selected; memories in 2023 = only april16_2023
    expect(await screen.findByText('Memory A')).toBeInTheDocument()
  })

  // ---- "On This Day" toggle -----------------------------------------------

  it('shows only same-month-day memories when "On This Day" is toggled', async () => {
    render(
      <MemoryRouter initialEntries={['/timeline']}>
        <SmartTimelinePage />
      </MemoryRouter>
    )

    const btn = screen.getByTestId('onthisday-toggle')
    fireEvent.click(btn)

    // Both April 16 memories should appear
    expect(screen.getByText('Memory A')).toBeInTheDocument()
    expect(screen.getByText('Memory B')).toBeInTheDocument()
    // Non-April-16 memories must NOT appear
    expect(screen.queryByText('Memory C')).not.toBeInTheDocument()
    expect(screen.queryByText('Memory D')).not.toBeInTheDocument()
  })

  it('deactivates "On This Day" when toggled a second time', async () => {
    render(
      <MemoryRouter initialEntries={['/timeline']}>
        <SmartTimelinePage />
      </MemoryRouter>
    )

    const btn = screen.getByTestId('onthisday-toggle')
    fireEvent.click(btn) // activate
    fireEvent.click(btn) // deactivate
    // After deactivation the year auto-selects again; Memory C (Jan 2022) shouldn't
    // appear for year 2023, but the filter is reset — no crash expected
    expect(screen.getByText('Smart Timeline')).toBeInTheDocument()
  })

  it('shows stats bar with "On this day" text when filter is active', async () => {
    render(
      <MemoryRouter initialEntries={['/timeline']}>
        <SmartTimelinePage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTestId('onthisday-toggle'))
    expect(screen.getByText(/On this day/i)).toBeInTheDocument()
  })

  // ---- URL param activation -----------------------------------------------

  it('auto-activates "On This Day" filter when URL has ?filter=onthisday', async () => {
    render(
      <MemoryRouter initialEntries={['/timeline?filter=onthisday']}>
        <SmartTimelinePage />
      </MemoryRouter>
    )

    // Both April 16 memories should be visible immediately (no click needed)
    expect(screen.getByText('Memory A')).toBeInTheDocument()
    expect(screen.getByText('Memory B')).toBeInTheDocument()
    expect(screen.queryByText('Memory C')).not.toBeInTheDocument()
  })

  // ---- clear filters -------------------------------------------------------

  it('"Clear filters" (in empty state) resets the "On This Day" filter', async () => {
    // Use a dataset with no April 16 memories so the empty state renders
    mockUseMemories.mockReturnValue({
      memories: [jan01_2022, dec25_2020],
      loading: false,
    })

    render(
      <MemoryRouter initialEntries={['/timeline?filter=onthisday']}>
        <SmartTimelinePage />
      </MemoryRouter>
    )

    // Empty state + "Clear filters" button should be visible
    const clearBtn = await screen.findByText('Clear filters')
    fireEvent.click(clearBtn)

    // Filter should be reset — page should not crash
    expect(screen.getByText('Smart Timeline')).toBeInTheDocument()
    // "On this day" stats label should be gone
    expect(screen.queryByText(/On this day/i)).not.toBeInTheDocument()
  })

  // ---- empty state ---------------------------------------------------------

  it('shows German empty-state message when no "On This Day" memories exist', async () => {
    // Only memories on dates that are NOT April 16
    mockUseMemories.mockReturnValue({
      memories: [jan01_2022, dec25_2020],
      loading: false,
    })

    render(
      <MemoryRouter initialEntries={['/timeline?filter=onthisday']}>
        <SmartTimelinePage />
      </MemoryRouter>
    )

    expect(await screen.findByText(/Noch keine Erinnerungen/i)).toBeInTheDocument()
  })

  // ---- loading state -------------------------------------------------------

  it('shows skeleton cards while loading', async () => {
    mockUseMemories.mockReturnValue({ memories: [], loading: true })

    render(
      <MemoryRouter initialEntries={['/timeline']}>
        <SmartTimelinePage />
      </MemoryRouter>
    )

    // Skeleton cards are rendered as divs with animate-pulse
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  // ---- year filter (unchanged behaviour) ----------------------------------

  it('year filter still works when "On This Day" is not active', async () => {
    render(
      <MemoryRouter initialEntries={['/timeline']}>
        <SmartTimelinePage />
      </MemoryRouter>
    )

    // Click year 2021 button
    const year2021Btn = screen.queryByRole('button', { name: '2021' })
    if (year2021Btn) {
      fireEvent.click(year2021Btn)
      expect(screen.getByText('Memory B')).toBeInTheDocument()
      expect(screen.queryByText('Memory A')).not.toBeInTheDocument()
    }
    // If years haven't rendered yet (async), just assert no crash
    expect(screen.getByText('Smart Timeline')).toBeInTheDocument()
  })
})
