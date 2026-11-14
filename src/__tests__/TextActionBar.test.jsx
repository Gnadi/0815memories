import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TextActionBar from '../components/scrapbook/TextActionBar'

const heading = { id: 't', type: 'text', fontFamily: 'display', fontSize: 48, fontWeight: 'bold', textAlign: 'center', color: '#2D1B0E' }
const bar = (props) => render(<TextActionBar element={heading} onChange={vi.fn()} {...props} />)

describe('TextActionBar', () => {
  it('turns a heading into smaller text in another face', () => {
    const onChange = vi.fn()
    bar({ onChange })
    fireEvent.click(screen.getByRole('button', { name: 'Sans' }))
    expect(onChange).toHaveBeenLastCalledWith({ fontFamily: 'sans' })
    fireEvent.change(screen.getByLabelText('Size'), { target: { value: '18' } })
    expect(onChange).toHaveBeenLastCalledWith({ fontSize: 18 })
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }))
    expect(onChange).toHaveBeenLastCalledWith({ fontWeight: 'normal' })
  })

  it('marks the current face, alignment and colour', () => {
    bar()
    expect(screen.getByRole('button', { name: 'Display' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Center' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '#2D1B0E' })).toHaveAttribute('aria-pressed', 'true')
  })
})
