import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Mocks — declared before the page under test is imported
// ---------------------------------------------------------------------------

vi.mock('../config/firebase', () => ({ db: {}, auth: null, messaging: null }))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ familyId: 'test-family', encryptionKey: null, isAuthenticated: true, isAdmin: true }),
}))

const mockAddCollage = vi.fn().mockResolvedValue('collage-1')
vi.mock('../hooks/useCollages', () => ({
  useCollages: () => ({
    collages: [],
    loading: false,
    addCollage: mockAddCollage,
    deleteCollage: vi.fn(),
  }),
}))

vi.mock('../hooks/useMemoryPhotos', () => ({
  useMemoryPhotos: () => ({ photos: [], loading: false }),
}))

// The page's chrome pulls in the router and the whole nav tree; neither is what
// this test is about.
vi.mock('../components/layout/Sidebar', () => ({ default: () => null }))
vi.mock('../components/layout/MobileHeader', () => ({ default: () => null }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))

const { COLLAGE_TEMPLATES } = await import('../components/collage/collageTemplates')
const CollagesPage = (await import('../pages/CollagesPage')).default

describe('CollagesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
