/* The backup the app recommends as the last copy before a family is deleted.
   It used to say "Export complete!" whatever was missing from it; the files
   that failed were listed only inside the archive's manifest. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ familyId: 'fam1', encryptionKey: {}, user: { uid: 'uid-a' } }),
}))
vi.mock('../config/firebase', () => ({ db: {} }))
vi.mock('../services/family', () => ({ getFamily: async () => ({ familyName: 'Test' }) }))
const runNasExport = vi.fn()
vi.mock('../services/nasExport', () => ({ runNasExport: (...a) => runNasExport(...a) }))

const { default: NasExportButton } = await import('../components/admin/NasExportButton')

const exportWith = (failedDownloads) => runNasExport.mockImplementation(async ({ onProgress }) => {
  onProgress({ phase: 'done', current: 1, total: 1, message: '' })
  return { failedDownloads }
})

beforeEach(() => {
  runNasExport.mockReset()
})

describe('NasExportButton', () => {
  it('says the backup is incomplete when files could not be saved', async () => {
    exportWith(2)
    render(<NasExportButton />)
    fireEvent.click(screen.getByRole('button', { name: /Download Full Backup/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('2 files could not be backed up')
    expect(screen.queryByText(/Export complete/)).not.toBeInTheDocument()
  })

  it('says it is complete when nothing failed', async () => {
    exportWith(0)
    render(<NasExportButton />)
    fireEvent.click(screen.getByRole('button', { name: /Download Full Backup/ }))
    expect(await screen.findByText(/Export complete/)).toBeInTheDocument()
  })
})
