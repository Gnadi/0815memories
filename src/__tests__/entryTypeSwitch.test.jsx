import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../config/firebase', () => ({ db: {}, auth: null, messaging: null }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ encryptionKey: null }) }))
vi.mock('../components/media/EncryptedImage', () => ({ default: () => <img alt="" /> }))
vi.mock('../components/media/EncryptedVideo', () => ({ default: () => <video /> }))

const PostMomentModal = (await import('../components/admin/PostMomentModal')).default

describe('PostMomentModal type switch', () => {
  it('is hidden unless the caller can switch', () => {
    render(<PostMomentModal onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
  })

  it('hands the current form over as a memory draft', async () => {
    const onSwitchType = vi.fn()
    const moment = { id: 'm', caption: 'Picnic\nIn the park', location: 'Park', images: ['p.enc'], date: { seconds: 9 } }
    render(<PostMomentModal moment={moment} onClose={vi.fn()} onSave={vi.fn()} onSwitchType={onSwitchType} />)

    expect(screen.getByRole('radio', { checked: true })).toBeDisabled()
    await userEvent.click(screen.getByRole('radio', { checked: false }))
    expect(onSwitchType).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Picnic',
        content: 'In the park',
        location: 'Park',
        images: ['p.enc'],
        date: { seconds: 9 },
      })
    )
  })
})
