/* docs/moments-decryption.md §2.

   Tapping a story circle started a cold download of the full original — up to
   the 10 MB upload cap — for a surface that is at most a phone screen, while
   the 1024px copy of that same photo sat decrypted in the media cache, put
   there by the circle the user had just tapped. MemoryHero was fixed for this;
   MomentViewer was the last surface that never got the treatment.

   The story *is* the lightbox here, so the original still has to arrive. It
   just must not be what the viewer waits on. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'

const prefetchDecryptedMedia = vi.fn(async () => 'blob:decrypted')
vi.mock('../components/media/useDecryptedMedia', () => ({
  prefetchDecryptedMedia: (...args) => prefetchDecryptedMedia(...args),
}))
// Render the src/thumbSrc/tinyPreview triple as data attributes so the choice
// is assertable — it is invisible in the output otherwise.
vi.mock('../components/media/EncryptedImage', () => ({
  default: ({ src, thumbSrc, tinyPreview }) => (
    <img data-kind="image" data-src={src} data-thumb={thumbSrc ?? ''} data-tiny={tinyPreview ?? ''} alt="" />
  ),
}))
vi.mock('../components/media/EncryptedVideo', () => ({
  default: ({ src }) => <video data-kind="video" data-src={src} />,
}))
const auth = { encryptionKey: { fake: 'key' } }
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))

import MomentViewer from '../components/home/MomentViewer'

// `thumbs` and `thumbsTiny` only count when they line up with `images` exactly
// — see utils/mediaThumbs.js — so build all three together.
function moment(id, count = 1, { thumbs = true, tiny = true } = {}) {
  const idx = Array.from({ length: count }, (_, i) => i)
  return {
    id,
    caption: `caption ${id}`,
    date: new Date(),
    images: idx.map((i) => `https://cdn/${id}-${i}.enc`),
    ...(thumbs ? { thumbs: idx.map((i) => `https://cdn/${id}-${i}-thumb.enc`) } : {}),
    ...(tiny ? { thumbsTiny: idx.map((i) => `data:image/webp;base64,${id}${i}`) } : {}),
  }
}

// The mobile and desktop layouts are both mounted; Tailwind hides one with CSS.
const shown = () => Array.from(document.querySelectorAll('[data-kind]'))
const noop = () => {}

beforeEach(() => {
  vi.clearAllMocks()
  prefetchDecryptedMedia.mockImplementation(async () => 'blob:decrypted')
  auth.encryptionKey = { fake: 'key' }
})
afterEach(cleanup)

describe('what the story viewer asks for', () => {
  it('shows the thumbnail rather than downloading the original', () => {
    render(<MomentViewer moments={[moment('a')]} initialIndex={0} onClose={noop} />)

    for (const el of shown()) {
      expect(el.getAttribute('data-src')).toBe('https://cdn/a-0.enc')
      expect(el.getAttribute('data-thumb')).toBe('https://cdn/a-0-thumb.enc')
    }
    expect(shown().length).toBeGreaterThan(0)
  })

  it('carries the blur-up preview so the wait shows the photo, not a spinner', () => {
    render(<MomentViewer moments={[moment('a')]} initialIndex={0} onClose={noop} />)

    for (const el of shown()) {
      expect(el.getAttribute('data-tiny')).toBe('data:image/webp;base64,a0')
    }
  })

  it('warms the original and swaps to it once it lands', async () => {
    await act(async () => {
      render(<MomentViewer moments={[moment('a')]} initialIndex={0} onClose={noop} />)
    })

    expect(prefetchDecryptedMedia).toHaveBeenCalledWith(
      'https://cdn/a-0.enc',
      auth.encryptionKey,
      'image/*',
    )
    // Dropping thumbSrc points the element at a blob that is already decrypted.
    for (const el of shown()) {
      expect(el.getAttribute('data-thumb')).toBe('')
      expect(el.getAttribute('data-src')).toBe('https://cdn/a-0.enc')
    }
  })

  it('goes straight to the original when the moment has no thumbnail', async () => {
    await act(async () => {
      render(
        <MomentViewer moments={[moment('a', 1, { thumbs: false })]} initialIndex={0} onClose={noop} />,
      )
    })

    for (const el of shown()) {
      expect(el.getAttribute('data-thumb')).toBe('')
      expect(el.getAttribute('data-src')).toBe('https://cdn/a-0.enc')
    }
  })

  it('keeps ciphertext previews out of the element', () => {
    // A moment whose thumbsTiny never got decrypted — the read path this file's
    // sibling test covers. tinyPreviewAt refuses anything that is not a data URL.
    const raw = { ...moment('a'), thumbsTiny: ['kZ8fQ2t+Xy9abCDEF/ghIJKLmnop=='] }
    render(<MomentViewer moments={[raw]} initialIndex={0} onClose={noop} />)

    for (const el of shown()) {
      expect(el.getAttribute('data-tiny')).toBe('')
    }
  })
})

describe('what the story viewer warms next', () => {
  it('warms the neighbour thumbnail, not the neighbour original', async () => {
    await act(async () => {
      render(
        <MomentViewer moments={[moment('a'), moment('b')]} initialIndex={0} onClose={noop} />,
      )
    })

    const warmed = prefetchDecryptedMedia.mock.calls.map(([url]) => url)
    // The next moment's first photo is reached as a thumbnail first, so that is
    // what the warm-up has to hold.
    expect(warmed).toContain('https://cdn/b-0-thumb.enc')
    expect(warmed).not.toContain('https://cdn/b-0.enc')
  })

  it('warms the remaining photos of this moment as thumbnails too', async () => {
    await act(async () => {
      render(<MomentViewer moments={[moment('a', 3)]} initialIndex={0} onClose={noop} />)
    })

    const warmed = prefetchDecryptedMedia.mock.calls.map(([url]) => url)
    expect(warmed).toContain('https://cdn/a-1-thumb.enc')
    expect(warmed).toContain('https://cdn/a-2-thumb.enc')
    // Only the photo on screen is worth the full original.
    expect(warmed).toContain('https://cdn/a-0.enc')
    expect(warmed).not.toContain('https://cdn/a-1.enc')
  })

  it('still warms a video as the clip itself — there is no derivative', async () => {
    const withVideo = { ...moment('a'), videos: [{ url: 'https://cdn/a-clip.enc' }] }
    await act(async () => {
      render(<MomentViewer moments={[withVideo]} initialIndex={0} onClose={noop} />)
    })

    expect(prefetchDecryptedMedia).toHaveBeenCalledWith(
      'https://cdn/a-clip.enc',
      auth.encryptionKey,
      'video/*',
    )
  })
})
