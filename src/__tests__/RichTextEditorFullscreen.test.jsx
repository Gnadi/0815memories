/**
 * Fullscreen editing.
 *
 * Renders the real editor — the same minimal jsdom polyfills as
 * richEditorNodes.test.js make ProseMirror mount. Scoped to the shell around the
 * document, not to typing: the toggle, the overlay it produces, Escape, and the
 * body scroll lock, all of which are plain React state.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RichTextEditor from '../components/admin/RichTextEditor'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ encryptionKey: null }),
}))
// The recorder reaches for MediaRecorder/getUserMedia on mount paths we do not
// exercise here.
vi.mock('../components/admin/VoiceMemoRecorder', () => ({ default: () => null }))

beforeAll(() => {
  Range.prototype.getClientRects ||= () => []
  Range.prototype.getBoundingClientRect ||= () => ({ top: 0, left: 0, width: 0, height: 0 })
  globalThis.requestAnimationFrame ||= (cb) => setTimeout(cb, 0)
})

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

const setup = () => {
  const user = userEvent.setup()
  const utils = render(<RichTextEditor value={null} onChange={() => {}} />)
  return { user, ...utils }
}

const overlay = (container) => container.querySelector('.kaydo-fullscreen')

describe('RichTextEditor fullscreen', () => {
  it('starts inline, not as an overlay', () => {
    const { container } = setup()
    expect(overlay(container)).toBeNull()
    expect(screen.getByLabelText('Fullscreen')).toBeInTheDocument()
  })

  it('expands to a full-viewport overlay above the modal', async () => {
    const { container, user } = setup()
    await user.click(screen.getByLabelText('Fullscreen'))

    const el = overlay(container)
    expect(el).not.toBeNull()
    // z-50 is the highest layer in the app; the overlay has to clear it.
    expect(el.className).toContain('z-[60]')
    expect(el.className).toContain('fixed')
  })

  it('locks body scroll while expanded and restores it after', async () => {
    const { user } = setup()
    await user.click(screen.getByLabelText('Fullscreen'))
    expect(document.body.style.overflow).toBe('hidden')

    await user.click(screen.getByLabelText('Exit fullscreen'))
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('collapses on Escape', async () => {
    const { container, user } = setup()
    await user.click(screen.getByLabelText('Fullscreen'))
    expect(overlay(container)).not.toBeNull()

    await user.keyboard('{Escape}')
    expect(overlay(container)).toBeNull()
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('offers a way back to the form, since the save button is out of reach', async () => {
    const { user } = setup()
    await user.click(screen.getByLabelText('Fullscreen'))
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
  })

  it('keeps the formatting and media controls available while expanded', async () => {
    const { user } = setup()
    await user.click(screen.getByLabelText('Fullscreen'))
    for (const label of ['Bold', 'Italic', 'Heading', 'Insert photo', 'Insert voice memo']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })

  it('restores body scroll if it unmounts while still expanded', async () => {
    const { user, unmount } = setup()
    await user.click(screen.getByLabelText('Fullscreen'))
    expect(document.body.style.overflow).toBe('hidden')

    // Closing the whole memory form from underneath must not leave the page
    // unscrollable.
    unmount()
    expect(document.body.style.overflow).not.toBe('hidden')
  })
})
