/* The recipe pages as a viewer sees them: the recipes an admin has shared,
   and nothing that would write — no new recipe, no delete, no fork, no sharing
   box. firestore.rules refuse those writes anyway; these pin that the pages do
   not offer them. And the sharing box an admin does get. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../config/firebase', () => ({ db: {}, auth: null, messaging: null }))

const auth = { familyId: 'fam1', encryptionKey: null, isAuthenticated: true, isAdmin: false }
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))

const strudel = { id: 'strudel', title: "Grandma's strudel", author: 'Grandma', year: 1962, forkCount: 1, viewerVisible: true }
const fork = { id: 'moms', parentId: 'strudel', rootId: 'strudel', title: "Mom's strudel", author: 'Mom', year: 1990, viewerVisible: true }

let mockRecipes = []
const mockUseRecipes = vi.fn()
const mockSetViewerVisible = vi.fn()
let mockVersions = []
const mockUseRecipeLineage = vi.fn()
vi.mock('../hooks/useRecipes', () => ({
  useRecipes: (...args) => {
    mockUseRecipes(...args)
    return { recipes: mockRecipes, loading: false, deleteRecipe: vi.fn() }
  },
  useRecipeLineage: (...args) => {
    mockUseRecipeLineage(...args)
    return { versions: mockVersions, loading: false, setViewerVisible: mockSetViewerVisible }
  },
}))

vi.mock('../components/media/EncryptedImage', () => ({ default: () => null }))
vi.mock('../components/layout/Sidebar', () => ({ default: () => null }))
vi.mock('../components/layout/MobileHeader', () => ({ default: () => null }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useParams: () => ({ id: 'strudel' }) }))

const RecipesPage = (await import('../pages/RecipesPage')).default
const RecipeJourneyPage = (await import('../pages/RecipeJourneyPage')).default

beforeEach(() => {
  vi.clearAllMocks()
  auth.isAdmin = false
  mockRecipes = []
  mockVersions = [strudel, fork]
})

describe('the recipe list', () => {
  it('asks for the shared recipes only when a viewer opens it', () => {
    render(<RecipesPage />)
    expect(mockUseRecipes).toHaveBeenCalledWith('fam1', null, { viewer: true })

    auth.isAdmin = true
    render(<RecipesPage />)
    expect(mockUseRecipes).toHaveBeenLastCalledWith('fam1', null, { viewer: false })
  })

  it('offers a viewer no new recipe, and says that nothing is shared yet', () => {
    render(<RecipesPage />)
    expect(screen.getByText('No recipes shared yet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add/ })).not.toBeInTheDocument()
  })

  it('shows a viewer the shared recipes without the delete menu', () => {
    mockRecipes = [strudel]
    render(<RecipesPage />)
    expect(screen.getByText("Grandma's strudel")).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})

describe('the recipe page', () => {
  it('shows a viewer every version, and no fork or sharing', () => {
    render(<RecipeJourneyPage />)
    expect(mockUseRecipeLineage).toHaveBeenCalledWith('strudel', 'fam1', null, { viewer: true })
    expect(screen.getAllByText("Mom's strudel").length).toBeGreaterThan(0)
    expect(screen.queryByText('Fork This Recipe')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('lets an admin stop sharing the recipe', async () => {
    auth.isAdmin = true
    mockSetViewerVisible.mockResolvedValue()
    const user = userEvent.setup()
    render(<RecipeJourneyPage />)

    const box = screen.getByRole('checkbox', { name: /Visible to viewers/ })
    expect(box).toBeChecked()
    await user.click(box)
    expect(mockSetViewerVisible).toHaveBeenCalledWith(false)
  })

  it('shows the stored state again, and says so, when sharing fails', async () => {
    auth.isAdmin = true
    mockVersions = [{ ...strudel, viewerVisible: false }]
    mockSetViewerVisible.mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()
    render(<RecipeJourneyPage />)

    const box = screen.getByRole('checkbox', { name: /Visible to viewers/ })
    await user.click(box)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('could not be saved'))
    expect(box).not.toBeChecked()
  })
})
