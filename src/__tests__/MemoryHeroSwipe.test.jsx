import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MemoryHero from '../components/memory/MemoryHero'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}))
vi.mock('../components/media/EncryptedImage', () => ({
  default: ({ alt, className, onClick }) => (
    <img alt={alt ?? ''} data-testid="hero-image" className={className} onClick={onClick} />
  ),
}))

const images = ['a.jpg', 'b.jpg', 'c.jpg']

function touch(x, y) {
  return { clientX: x, clientY: y }
}

// Drives one gesture on the hero and returns the "n / total" counter text.
function swipe(container, { from, to, duration = 100, touches = 1 }) {
  const hero = container.firstChild
  vi.setSystemTime(new Date(0))
  fireEvent.touchStart(hero, { touches: Array(touches).fill(touch(...from)) })
  fireEvent.touchMove(hero, { touches: Array(touches).fill(touch(...to)) })
  vi.setSystemTime(new Date(duration))
  fireEvent.touchEnd(hero, { changedTouches: [touch(...to)] })
}

function renderHero() {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const { container } = render(<MemoryHero images={images} />)
  return container
}

function counter() {
  return screen.getByText(/\d \/ 3/).textContent
}

describe('MemoryHero swipe sensitivity', () => {
  it('advances on a long, fast, horizontal swipe', () => {
    const container = renderHero()
    swipe(container, { from: [300, 200], to: [180, 205] })
    expect(counter()).toBe('2 / 3')
  })

  it('goes back on a swipe to the right', () => {
    const container = renderHero()
    swipe(container, { from: [180, 200], to: [300, 205] })
    expect(counter()).toBe('3 / 3')
  })

  it('ignores a short nudge below the distance threshold', () => {
    const container = renderHero()
    swipe(container, { from: [300, 200], to: [240, 200] })
    expect(counter()).toBe('1 / 3')
  })

  it('ignores a mostly vertical drag', () => {
    const container = renderHero()
    swipe(container, { from: [300, 200], to: [180, 320] })
    expect(counter()).toBe('1 / 3')
  })

  it('ignores a slow drag', () => {
    const container = renderHero()
    swipe(container, { from: [300, 200], to: [150, 200], duration: 1500 })
    expect(counter()).toBe('1 / 3')
  })

  it('ignores a two-finger gesture (pinch-zoom)', () => {
    const container = renderHero()
    swipe(container, { from: [300, 200], to: [150, 200], touches: 2 })
    expect(counter()).toBe('1 / 3')
  })
})
