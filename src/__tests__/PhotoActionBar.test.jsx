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
    bar({ panel: 'rotate' })
    expect(screen.getByLabelText('Angle')).toHaveValue('-90')
    expect(screen.getByText('-90°')).toBeInTheDocument()
  })

  it('picks a filter, and clears it with Original', () => {
    const onStyle = vi.fn()
    bar({ panel: 'filter', onStyle })
    fireEvent.click(screen.getByText('B&W'))
    expect(onStyle).toHaveBeenLastCalledWith({ filter: 'bw' })
    fireEvent.click(screen.getByText('Original'))
    expect(onStyle).toHaveBeenLastCalledWith({ filter: null })
  })

  it('gives a frameless photo a visible frame when a colour is picked', () => {
    const onStyle = vi.fn()
    bar({ panel: 'frame', onStyle })
    fireEvent.click(screen.getByLabelText('#C25A2E'))
    expect(onStyle).toHaveBeenLastCalledWith({ borderColor: '#C25A2E', borderWidth: 6 })
    fireEvent.change(screen.getByLabelText('Corners'), { target: { value: '0.5' } })
    expect(onStyle).toHaveBeenLastCalledWith({ cornerRadius: 0.5 })
  })

  it('opens panels from the action strip', () => {
    const onTogglePanel = vi.fn()
    bar({ onTogglePanel })
    fireEvent.click(screen.getByText('Frame'))
    fireEvent.click(screen.getByText('Filter'))
    fireEvent.click(screen.getByText('Rotate'))
    expect(onTogglePanel.mock.calls.map(([p]) => p)).toEqual(['frame', 'filter', 'rotate'])
  })
})
