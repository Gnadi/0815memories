import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '../i18n'
import TextSizeSwitcher from '../components/TextSizeSwitcher'
import { setTextSize, getTextSize, TEXT_SIZE_KEY } from '../utils/textSize'

describe('text size', () => {
  beforeEach(() => {
    localStorage.clear()
    setTextSize('normal')
  })

  it('applies a pick to the page and remembers it on this device', () => {
    render(<TextSizeSwitcher variant="settings" />)
    fireEvent.click(screen.getByRole('button', { name: /extra large|sehr groß/i }))

    expect(document.documentElement.getAttribute('data-text-size')).toBe('xlarge')
    expect(localStorage.getItem(TEXT_SIZE_KEY)).toBe('xlarge')
    expect(getTextSize()).toBe('xlarge')
  })

  it('marks the active size and drops the attribute at normal size', () => {
    render(<TextSizeSwitcher variant="sidebar" />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[1])
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'true')
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(buttons[0])
    expect(document.documentElement.hasAttribute('data-text-size')).toBe(false)
  })

  it('ignores a size it does not know', () => {
    setTextSize('huge')
    expect(getTextSize()).toBe('normal')
    expect(localStorage.getItem(TEXT_SIZE_KEY)).toBeNull()
  })

  it('opens the mobile menu from the header button', () => {
    render(<TextSizeSwitcher variant="menu" />)
    expect(screen.queryByRole('group')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /text size|schriftgröße/i }))
    expect(screen.getByRole('group')).toBeInTheDocument()
  })
})
