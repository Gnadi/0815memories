import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../components/media/EncryptedImage', () => ({ default: () => null }))

const PhotoActionBar = (await import('../components/scrapbook/PhotoActionBar')).default

const photo = { id: 'p', type: 'photo', url: 'a.enc', rotation: 270 }
const bar = (props) => render(
  <PhotoActionBar element={photo} onTogglePanel={vi.fn()} onStyle={vi.fn()} {...props} />
)

describe('PhotoActionBar', () => {
  it('shows a stored 270° turn as −90° on the free-rotation slider', () => {
    bar({ panel: 'style' })
    fireEvent.click(screen.getByRole('tab', { name: 'Rotate' }))
    expect(screen.getByLabelText('Angle')).toHaveValue('-90')
    expect(screen.getByText('-90°')).toBeInTheDocument()
  })

  it('picks a filter, and clears it with Original', () => {
    const onStyle = vi.fn()
    bar({ panel: 'style', onStyle })
    fireEvent.click(screen.getByText('B&W'))
    expect(onStyle).toHaveBeenLastCalledWith({ filter: 'bw' })
    fireEvent.click(screen.getByText('Original'))
    expect(onStyle).toHaveBeenLastCalledWith({ filter: null })
  })

  it('gives a frameless photo a visible frame when a colour is picked', () => {
    const onStyle = vi.fn()
    bar({ panel: 'style', onStyle })
    fireEvent.click(screen.getByRole('tab', { name: 'Frame' }))
    fireEvent.click(screen.getByLabelText('#C25A2E'))
    expect(onStyle).toHaveBeenLastCalledWith({ borderColor: '#C25A2E', borderWidth: 6 })
    fireEvent.change(screen.getByLabelText('Corners'), { target: { value: '0.5' } })
    expect(onStyle).toHaveBeenLastCalledWith({ cornerRadius: 0.5 })
  })

  it('groups frame, filter and rotation under one Style action', () => {
    const onTogglePanel = vi.fn()
    bar({ onTogglePanel })
    expect(screen.queryByText('Frame')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Style'))
    expect(onTogglePanel).toHaveBeenCalledWith('style')
  })

  it('opens the Style panel on filters', () => {
    bar({ panel: 'style' })
    expect(screen.getByRole('tab', { name: 'Filter' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('B&W')).toBeInTheDocument()
  })
})
