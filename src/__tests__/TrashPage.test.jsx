import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const restoreFromTrash = vi.fn(async () => {})
const deleteForever = vi.fn(async () => {})
let trash = { groups: [], loading: false, error: null }

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ familyId: 'family-1', encryptionKey: {} }) }))
vi.mock('../hooks/useTrash', () => ({ useTrash: () => trash }))
vi.mock('../services/trash', () => ({
  TRASH_DAYS: 30,
  restoreFromTrash: (...args) => restoreFromTrash(...args),
  deleteForever: (...args) => deleteForever(...args),
}))
vi.mock('../components/layout/Sidebar', () => ({ default: () => null }))
vi.mock('../components/layout/MobileHeader', () => ({ default: () => null }))

const { default: TrashPage } = await import('../pages/TrashPage')

const KID = {
  id: 'children__k1',
  collection: 'children',
  title: 'Lena',
  more: 2,
  deletedAt: new Date(2026, 9, 1),
  purgeAt: new Date(2026, 9, 31),
  entries: [],
}

const show = () => render(<MemoryRouter><TrashPage /></MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  trash = { groups: [KID], loading: false, error: null }
})

describe('TrashPage', () => {
  it('says what each item is, what went with it, and when it goes for good', () => {
    show()
    expect(screen.getByText('Lena')).toBeInTheDocument()
    expect(screen.getByText('Child')).toBeInTheDocument()
    expect(screen.getByText('with 2 journal entries')).toBeInTheDocument()
    expect(screen.getByText(/deleted for good on October 31, 2026/)).toBeInTheDocument()
  })

  it('restores a group', async () => {
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }))
    expect(restoreFromTrash).toHaveBeenCalledWith(KID)
  })

  it('deletes for good only once that is confirmed', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Delete for good' }))
    expect(deleteForever).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Delete for good' }))
    expect(deleteForever).toHaveBeenCalledWith(KID)
    confirm.mockRestore()
  })

  it('does not pass off a trash it could not read as an empty one', () => {
    trash = { groups: [], loading: false, error: new Error('permission-denied') }
    show()
    expect(screen.getByRole('alert')).toHaveTextContent("The trash couldn't be loaded.")
    expect(screen.queryByText('The trash is empty.')).not.toBeInTheDocument()
  })
})
