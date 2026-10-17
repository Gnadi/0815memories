/* The recipe form: ingredients pasted as a list or a table, and a fork that
   starts from the original's ingredients and instructions. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../config/firebase', () => ({ db: {}, auth: null, messaging: null }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ familyId: 'fam1', encryptionKey: null, isAuthenticated: true, isAdmin: true }),
}))

const mockAddRecipe = vi.fn()
vi.mock('../hooks/useRecipes', () => ({
  useRecipes: () => ({ recipes: [], loading: false, addRecipe: mockAddRecipe }),
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

const ingredientNames = () =>
  screen.queryAllByPlaceholderText('e.g. 2 cups ground lentils').map((input) => input.value)

beforeEach(() => {
  mockParams = {}
  mockAddRecipe.mockReset().mockResolvedValue({ id: 'new' })
  mockGetRecipe.mockReset()
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
