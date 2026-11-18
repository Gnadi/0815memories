/* docs/media-performance.md §4. MemoryHero passed no thumbSrc and never warmed
   its neighbours, so the hero — 520px tall at most — downloaded the full
   original, and every arrow press paid a fresh full download from cold.
   MomentViewer had the ten lines for this already. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'

const prefetchDecryptedMedia = vi.fn()
vi.mock('../components/media/useDecryptedMedia', () => ({
  prefetchDecryptedMedia: (...args) => prefetchDecryptedMedia(...args),
}))
// Render the src/thumbSrc pair as data attributes so the choice is assertable.
vi.mock('../components/media/EncryptedImage', () => ({
  default: ({ src, thumbSrc, tinyPreview, onClick, className }) => (
    <img
      data-src={src}
      data-thumb={thumbSrc ?? ''}
      data-tiny={tinyPreview ?? ''}
      className={className}
      onClick={onClick}
      alt=""
    />
  ),
}))
// The lightbox crossfades; render what it was given the same way.
vi.mock('../components/media/CrossfadeImage', () => ({
  default: ({ src, thumbSrc, tinyPreview }) => (
    <img data-lightbox="" data-src={src} data-thumb={thumbSrc ?? ''} data-tiny={tinyPreview ?? ''} alt="" />
  ),
}))
const auth = { encryptionKey: { fake: 'key' } }
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))

import MemoryHero from '../components/memory/MemoryHero'

const IMAGES = ['https://cdn/a.enc', 'https://cdn/b.enc', 'https://cdn/c.enc']
const THUMBS = ['https://cdn/a-t.enc', 'https://cdn/b-t.enc', 'https://cdn/c-t.enc']

beforeEach(() => {
  vi.clearAllMocks()
  auth.encryptionKey = { fake: 'key' }
})
afterEach(cleanup)

const images = () => Array.from(document.querySelectorAll('img'))

describe('the hero image', () => {
  it('shows the thumbnail rather than downloading the original', () => {
    render(<MemoryHero images={IMAGES} thumbs={THUMBS} />)
    const img = images()[0]
    expect(img.getAttribute('data-src')).toBe(IMAGES[0])
    expect(img.getAttribute('data-thumb')).toBe(THUMBS[0])
  })

  it('shows the blur-up preview of the photo on screen while it loads', () => {
    const TINY = ['data:image/webp;base64,AAA', 'data:image/webp;base64,BBB', 'data:image/webp;base64,CCC']
    render(<MemoryHero images={IMAGES} thumbs={THUMBS} thumbsTiny={TINY} />)
    expect(images()[0].getAttribute('data-tiny')).toBe(TINY[0])
  })

  it('falls back to the original when a document has no thumbs yet', () => {
    render(<MemoryHero images={IMAGES} />)
    expect(images()[0].getAttribute('data-thumb')).toBe('')
  })

  it('ignores a thumbs array that does not line up with the images', () => {
    // mediaThumbs is deliberately fail-safe: a mid-backfill document must land
    // on the original rather than risk pairing the wrong photo.
    render(<MemoryHero images={IMAGES} thumbs={['only-one']} />)
    expect(images()[0].getAttribute('data-thumb')).toBe('')
  })

  it('opens the lightbox on the thumbnail already on screen, with the original to follow', () => {
    // The original alone showed a placeholder square until it had loaded.
    render(<MemoryHero images={IMAGES} thumbs={THUMBS} />)
    fireEvent.click(images()[0])

    const lightbox = document.querySelector('[data-lightbox]')
    expect(lightbox.getAttribute('data-src')).toBe(IMAGES[0])
    expect(lightbox.getAttribute('data-thumb')).toBe(THUMBS[0])
  })
})

describe('warming the neighbours', () => {
  it('prefetches the next and previous photo on mount', () => {
    render(<MemoryHero images={IMAGES} thumbs={THUMBS} />)

    const asked = prefetchDecryptedMedia.mock.calls.map(([u]) => u)
    expect(asked).toContain(THUMBS[1])   // next
    expect(asked).toContain(THUMBS[2])   // previous, wrapping round
    expect(asked).not.toContain(THUMBS[0])
  })

  it('re-warms around the new index after an arrow press', () => {
    render(<MemoryHero images={IMAGES} thumbs={THUMBS} />)
    prefetchDecryptedMedia.mockClear()

    // The right-hand chevron is the second button in the hero.
    fireEvent.click(document.querySelectorAll('button')[2])

    const asked = prefetchDecryptedMedia.mock.calls.map(([u]) => u)
    expect(asked).toContain(THUMBS[2])
    expect(asked).toContain(THUMBS[0])
  })

  it('does nothing for a single-photo memory', () => {
    render(<MemoryHero images={[IMAGES[0]]} />)
    expect(prefetchDecryptedMedia).not.toHaveBeenCalled()
  })

  it('does nothing before the encryption key has arrived', () => {
    auth.encryptionKey = null
    render(<MemoryHero images={IMAGES} thumbs={THUMBS} />)
    expect(prefetchDecryptedMedia).not.toHaveBeenCalled()
  })

  it('warms what the hero will show: the thumbs, leaving the originals to the lightbox', () => {
    // An arrow press shows the neighbour's thumb. Warming its original fetched
    // up to two full-size photos per page that only the lightbox uses.
    render(<MemoryHero images={IMAGES} thumbs={THUMBS} />)
    const asked = prefetchDecryptedMedia.mock.calls.map(([u]) => u)
    for (const original of IMAGES) expect(asked).not.toContain(original)
  })

  it('warms the originals of a memory that has no thumbs yet', () => {
    render(<MemoryHero images={IMAGES} />)
    const asked = prefetchDecryptedMedia.mock.calls.map(([u]) => u)
    expect(asked).toEqual(expect.arrayContaining([IMAGES[1], IMAGES[2]]))
  })
})

describe('a memory with no images at all', () => {
  it('renders the placeholder and prefetches nothing', () => {
    render(<MemoryHero images={[]} />)
    expect(document.querySelector('svg')).toBeInTheDocument()
    expect(prefetchDecryptedMedia).not.toHaveBeenCalled()
  })

  it('still handles the single legacy imageUrl field', () => {
    render(<MemoryHero images={[]} imageUrl="https://cdn/legacy.enc" />)
    expect(images()[0].getAttribute('data-src')).toBe('https://cdn/legacy.enc')
  })
})
