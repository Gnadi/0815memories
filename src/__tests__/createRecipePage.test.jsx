/* The recipe form: ingredients pasted as a list or a table, a fork that
   starts from the original's ingredients and instructions, and correcting a
   recipe or a fork — offered to admins only, on the version's page. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../config/firebase', () => ({ db: {}, auth: null, messaging: null }))
const auth = { familyId: 'fam1', encryptionKey: null, isAuthenticated: true, isAdmin: true }
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))

const mockAddRecipe = vi.fn()
const mockUpdateRecipe = vi.fn()
vi.mock('../hooks/useRecipes', () => ({
  useRecipes: () => ({ recipes: [], loading: false, addRecipe: mockAddRecipe, updateRecipe: mockUpdateRecipe }),
}))

const mockGetRecipe = vi.fn()
vi.mock('../services/recipes', () => ({ getRecipe: (...args) => mockGetRecipe(...args) }))

let mockParams = {}
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, useParams: () => mockParams }))

vi.mock('../components/layout/Sidebar', () => ({ default: () => null }))
vi.mock('../components/layout/MobileHeader', () => ({ default: () => null }))
vi.mock('../components/media/EncryptedImage', () => ({ default: () => null }))
vi.mock('../components/admin/RichTextEditorLazy', () => ({
  default: ({ value }) => <div data-testid="rich-editor">{JSON.stringify(value)}</div>,
}))

const CreateRecipePage = (await import('../pages/CreateRecipePage')).default
const RecipeVersionDetailPage = (await import('../pages/RecipeVersionDetailPage')).default

const ingredientNames = () =>
  screen.queryAllByPlaceholderText('e.g. 2 cups ground lentils').map((input) => input.value)

beforeEach(() => {
  mockParams = {}
  auth.isAdmin = true
  mockAddRecipe.mockReset().mockResolvedValue({ id: 'new' })
  mockUpdateRecipe.mockReset().mockResolvedValue()
  mockGetRecipe.mockReset()
  mockNavigate.mockReset()
})

describe('pasting ingredients', () => {
  it('turns a list pasted into one field into one ingredient per line', async () => {
    const user = userEvent.setup()
    render(<CreateRecipePage />)
    await user.click(screen.getByRole('button', { name: 'Add Ingredient' }))

    fireEvent.paste(screen.getByPlaceholderText('e.g. 2 cups ground lentils'), {
      clipboardData: { getData: () => '- 200 g flour\n- 2 eggs\n- salt' },
    })

    expect(ingredientNames()).toEqual(['200 g flour', '2 eggs', 'salt'])
  })

  it('leaves a single pasted line to the field', async () => {
    const user = userEvent.setup()
    render(<CreateRecipePage />)
    await user.click(screen.getByRole('button', { name: 'Add Ingredient' }))
    const input = screen.getByPlaceholderText('e.g. 2 cups ground lentils')

    const notCancelled = fireEvent.paste(input, { clipboardData: { getData: () => '200 g flour' } })

    expect(notCancelled).toBe(true)
    expect(ingredientNames()).toEqual([''])
  })

  it('adds a pasted table from the paste box', async () => {
    const user = userEvent.setup()
    render(<CreateRecipePage />)
    await user.click(screen.getByRole('button', { name: 'Paste a list' }))

    fireEvent.change(screen.getByLabelText('Paste a list or table'), {
      target: { value: 'Amount\tIngredient\n200 g\tflour\n2\teggs' },
    })
    await user.click(screen.getByRole('button', { name: 'Add 2 ingredients' }))

    expect(ingredientNames()).toEqual(['200 g flour', '2 eggs'])
    expect(screen.queryByLabelText('Paste a list or table')).toBeNull()
  })
})

describe('a fork', () => {
  it('starts from the original\'s ingredients and instructions', async () => {
    mockParams = { id: 'pie' }
    mockGetRecipe.mockResolvedValue({
      id: 'pie', title: 'Pie', author: 'Grandma', year: 1970,
      ingredients: [{ name: 'Apples', status: 'active' }],
      instructionsFormat: 'markdown', instructions: '1. **Bake**',
    })
    render(<CreateRecipePage />)

    await waitFor(() => expect(ingredientNames()).toEqual(['Apples']))
    expect(screen.getByRole('radio', { name: 'Markdown' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByDisplayValue('1. **Bake**')).toBeInTheDocument()
  })
})

describe('editing', () => {
  const fork = {
    id: 'moms', parentId: 'pie', rootId: 'pie', viewerVisible: true, familyId: 'fam1',
    title: "Mom's pie", author: 'Mom', year: 1990, description: 'With caramel', chefNote: 'Sea salt',
    forkReason: 'For the holidays', changes: [{ type: 'ADDED', ingredient: 'Caramel', description: 'On top' }],
    ingredients: [{ name: 'Apples', status: 'active' }, { name: 'Caramel', status: 'modified' }],
    instructionsFormat: 'markdown', instructions: '1. Bake', image: 'https://res.example/img',
  }

  it('opens a fork with everything it holds', async () => {
    mockParams = { id: 'moms' }
    mockGetRecipe.mockResolvedValue(fork)
    render(<CreateRecipePage mode="edit" />)

    await waitFor(() => expect(screen.getByDisplayValue("Mom's pie")).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: "Edit Mom's pie" })).toBeInTheDocument()
    expect(screen.getByText('The Fork Story')).toBeInTheDocument()
    expect(screen.getByDisplayValue('For the holidays')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1. Bake')).toBeInTheDocument()
    expect(ingredientNames()).toEqual(['Apples', 'Caramel'])
  })

  it('saves the corrected fields only, never the lineage or the sharing flag', async () => {
    const user = userEvent.setup()
    mockParams = { id: 'moms' }
    mockGetRecipe.mockResolvedValue(fork)
    render(<CreateRecipePage mode="edit" />)
    const title = await screen.findByDisplayValue("Mom's pie")

    await user.clear(title)
    await user.type(title, "Mom's caramel pie")
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(mockUpdateRecipe).toHaveBeenCalledTimes(1))
    const [id, data] = mockUpdateRecipe.mock.calls[0]
    expect(id).toBe('moms')
    expect(data).toMatchObject({
      title: "Mom's caramel pie",
      instructionsFormat: 'markdown',
      instructions: '1. Bake',
      instructionsRich: null,
      forkReason: 'For the holidays',
      changes: [{ type: 'ADDED', ingredient: 'Caramel', description: 'On top' }],
      ingredients: [{ name: 'Apples', status: 'active' }, { name: 'Caramel', status: 'modified' }],
      image: 'https://res.example/img',
    })
    for (const field of ['parentId', 'rootId', 'viewerVisible', 'familyId', 'createdAt']) {
      expect(data).not.toHaveProperty(field)
    }
    expect(mockAddRecipe).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/recipes/pie/version/moms')
  })

  it('leaves a family recipe without a fork story', async () => {
    const user = userEvent.setup()
    mockParams = { id: 'pie' }
    mockGetRecipe.mockResolvedValue({ id: 'pie', parentId: null, rootId: null, title: 'Pie', author: 'Grandma', year: 1970 })
    render(<CreateRecipePage mode="edit" />)
    await screen.findByDisplayValue('Pie')

    expect(screen.queryByText('The Fork Story')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(mockUpdateRecipe).toHaveBeenCalled())
    expect(mockUpdateRecipe.mock.calls[0][1]).not.toHaveProperty('forkReason')
    expect(mockNavigate).toHaveBeenCalledWith('/recipes/pie/version/pie')
  })

  it('is offered on a version\'s page to admins, not to viewers', async () => {
    mockParams = { rootId: 'pie', versionId: 'moms' }
    mockGetRecipe.mockResolvedValue(fork)
    const { unmount } = render(<RecipeVersionDetailPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    expect(mockNavigate).toHaveBeenCalledWith('/recipes/moms/edit')
    unmount()

    auth.isAdmin = false
    render(<RecipeVersionDetailPage />)
    await screen.findByText("Mom's pie")
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
  })
})
