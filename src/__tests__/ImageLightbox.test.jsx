/* The landing page's click-to-enlarge gallery: opens on a screenshot, steps
   through the page's pictures, closes on Escape and hands focus back. */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { LightboxProvider, ZoomTarget } from '../components/landing/ImageLightbox'

const labels = { close: 'Close', previous: 'Previous', next: 'Next' }

function Page() {
  return (
    <LightboxProvider labels={labels}>
      <ZoomTarget src="/a.webp" alt="First"><img src="/a.webp" alt="First" /></ZoomTarget>
      <ZoomTarget src="/b.webp" alt="Second"><img src="/b.webp" alt="Second" /></ZoomTarget>
    </LightboxProvider>
  )
}

function setDesktop(matches) {
  window.matchMedia = vi.fn().mockReturnValue({ matches })
}

describe('landing page lightbox', () => {
  beforeEach(() => setDesktop(true))
  afterEach(cleanup)

  it('opens on the clicked picture and steps through the others', () => {
    render(<Page />)
    fireEvent.click(screen.getByRole('button', { name: 'Second' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleName('Second')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByRole('dialog')).toHaveAccessibleName('First')
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Second')
  })

  it('closes on Escape and returns focus to the picture', () => {
    render(<Page />)
    const first = screen.getByRole('button', { name: 'First' })
    fireEvent.click(first)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(first)
  })

  it('does nothing on a narrow screen, where the picture is already full width', () => {
    setDesktop(false)
    render(<Page />)
    fireEvent.click(screen.getByRole('button', { name: 'First' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders the picture as it is without a provider', () => {
    render(<ZoomTarget src="/a.webp" alt="First"><img src="/a.webp" alt="First" /></ZoomTarget>)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('img')).toBeTruthy()
  })
})
