import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '../i18n'
import TextSizeSwitcher from '../components/TextSizeSwitcher'
import { setTextSize, getTextSize, TEXT_SIZE_KEY, TEXT_SIZE_STEPS } from '../utils/textSize'

describe('text size', () => {
  beforeEach(() => {
    localStorage.clear()
    setTextSize(100)
  })

  it('applies a slider step to the page and remembers it on this device', () => {
    render(<TextSizeSwitcher variant="settings" />)
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: String(TEXT_SIZE_STEPS.indexOf(160)) } })

    expect(document.documentElement.style.fontSize).toBe('160%')
    expect(localStorage.getItem(TEXT_SIZE_KEY)).toBe('160')
    expect(getTextSize()).toBe(160)
    expect(slider).toHaveAttribute('aria-valuetext', '160%')
  })

  it('leaves the page at its own size at 100%', () => {
    setTextSize(140)
    setTextSize(100)
    expect(document.documentElement.style.fontSize).toBe('')
  })

  it('ignores a size that is not a step', () => {
    setTextSize(500)
    expect(getTextSize()).toBe(100)
    expect(localStorage.getItem(TEXT_SIZE_KEY)).toBeNull()
  })

  it('opens the slider from the header button and closes it with Escape', () => {
    render(<TextSizeSwitcher variant="icon" />)
    const toggle = screen.getByRole('button')
    expect(screen.queryByRole('slider')).toBeNull()

    fireEvent.click(toggle)
    expect(screen.getByRole('slider')).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('slider')).toBeNull()
  })

  // The page grows with every step, and the button with it; a popover hung
  // from the button slid away under the finger while it was dragged.
  it('pins the popover to the screen where it opened', () => {
    render(<TextSizeSwitcher variant="icon" />)
    const toggle = screen.getByRole('button')
    toggle.getBoundingClientRect = () => ({ top: 20, bottom: 60, left: 300, right: 340 })
    fireEvent.click(toggle)

    const popover = screen.getByRole('dialog')
    expect(popover.style.top).toBe('70px')
    expect(popover.style.right).toBe(`${window.innerWidth - 340}px`)

    toggle.getBoundingClientRect = () => ({ top: 80, bottom: 120, left: 300, right: 340 })
    fireEvent.change(screen.getByRole('slider'), { target: { value: '8' } })
    expect(popover.style.top).toBe('70px')
  })
})
