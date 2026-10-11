/* The best-of, played as a story (components/bestof/BestOfViewer.jsx).

   Its clock is the progress bar's fill animation, which jsdom never runs, so
   the tests end it by hand: that is exactly the event the viewer listens to.
   The media components are stand-ins; the decryption is theirs to test. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'

const prefetchDecryptedMedia = vi.fn(async () => 'blob:decrypted')
vi.mock('../components/media/useDecryptedMedia', () => ({
  default: (url) => ({ decryptedUrl: url ? `blob:${url}` : null, loading: false, error: null }),
  prefetchDecryptedMedia: (...args) => prefetchDecryptedMedia(...args),
}))
// The stage, reduced to what the slides hand it.
vi.mock('../components/media/CrossfadeImage', () => ({
  default: ({ src, onSettled }) => (
    <img data-kind="stage" data-src={src} alt="" onLoad={() => onSettled?.(src)} />
  ),
}))
vi.mock('../components/media/EncryptedVideo', () => ({
  default: ({ src, ref, onLoadedData, onTimeUpdate, onEnded }) => (
    <video ref={ref} data-kind="video" data-src={src} onLoadedData={onLoadedData} onTimeUpdate={onTimeUpdate} onEnded={onEnded} />
  ),
}))
const auth = { encryptionKey: { fake: 'key' } }
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))

import BestOfViewer from '../components/bestof/BestOfViewer'

const media = (url) => ({ url, thumbUrl: `${url}-t` })

const BEST_OF = {
  version: 1,
  month: '2026-09',
  cover: media('a'),
  slides: [
    { kind: 'intro', media: [media('a'), media('b')] },
    { kind: 'count', photos: 12, videos: 1, media: media('b') },
    { kind: 'photo', media: media('c'), caption: 'At the lake', location: 'Zell am See', day: '2026-09-06' },
    { kind: 'video', media: { url: 'clip' }, caption: 'Splash', day: '2026-09-07' },
    { kind: 'awardIntro', award: 'smile', media: media('d') },
    { kind: 'award', award: 'smile', media: media('d'), caption: 'Leo' },
    { kind: 'someday-a-new-kind', media: media('e') },
    { kind: 'outro', media: [media('a')] },
  ],
}

const stage = () => screen.getByTestId('bestof-stage')
const kind = () => document.querySelector('[data-testid^="bestof-slide-"]').dataset.testid.replace('bestof-slide-', '')
// jsdom has no AnimationEvent, so React listens for the prefixed name there.
const endClock = () =>
  act(() => {
    screen.getByTestId('bestof-fill').dispatchEvent(new Event('webkitAnimationEnd', { bubbles: true }))
  })

// A tap: down and up at once, at a share of the stage's width.
function tap(share) {
  const el = stage()
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 800, right: 400, bottom: 800 })
  const at = { clientX: 400 * share, clientY: 400 }
  fireEvent.pointerDown(el, at)
  fireEvent.pointerUp(el, at)
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  prefetchDecryptedMedia.mockClear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('BestOfViewer', () => {
  it('opens on the month, named in the reader’s language', () => {
    render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
    expect(kind()).toBe('intro')
    expect(screen.getByText('SEP')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Best of September' })).toBeInTheDocument()
  })

  it('moves on when a slide’s time is up, and steps with taps either way', () => {
    render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
    endClock()
    expect(kind()).toBe('count')
    expect(screen.getByText('photos and videos')).toBeInTheDocument()

    tap(0.8)
    expect(kind()).toBe('photo')
    expect(screen.getByText('At the lake')).toBeInTheDocument()
    expect(screen.getByText('Sep 6 · Zell am See')).toBeInTheDocument()

    tap(0.1)
    expect(kind()).toBe('count')
  })

  it('plays a clip to its end rather than on a clock', () => {
    render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
    tap(0.8)
    tap(0.8)
    tap(0.8)
    expect(kind()).toBe('video')
    expect(screen.queryByTestId('bestof-fill')).toBeNull()
    // Its last timeupdate reaches the end, and then it ends — before React has
    // rendered in between, as a browser may: one step, not two.
    const clip = document.querySelector('[data-kind="video"]')
    Object.defineProperty(clip, 'duration', { value: 5 })
    Object.defineProperty(clip, 'currentTime', { value: 5 })
    act(() => {
      clip.dispatchEvent(new Event('timeupdate'))
      clip.dispatchEvent(new Event('ended'))
    })
    expect(kind()).toBe('awardIntro')
  })

  it('announces an award, then shows it', () => {
    render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
    for (let i = 0; i < 4; i++) tap(0.8)
    expect(screen.getByText('and the biggest smile award goes to…')).toBeInTheDocument()
    tap(0.8)
    expect(kind()).toBe('award')
    expect(screen.getByText('Biggest smile')).toBeInTheDocument()
  })

  it('leaves out slides it does not know, and stays on the last one', () => {
    render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
    expect(document.querySelectorAll('[aria-hidden="true"] > span.flex-1')).toHaveLength(7)
    for (let i = 0; i < 6; i++) tap(0.8)
    expect(kind()).toBe('outro')
    endClock()
    expect(kind()).toBe('outro')
  })

  it('pauses on hold and on the button, with the pill in the bar, and goes on where it was', () => {
    render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
    const fill = screen.getByTestId('bestof-fill')

    fireEvent.pointerDown(stage(), { clientX: 300, clientY: 400 })
    act(() => vi.advanceTimersByTime(400))
    expect(screen.getByText('Paused')).toBeInTheDocument()
    // The same fill, paused — not a new one that would start the slide over.
    expect(screen.getByTestId('bestof-fill')).toBe(fill)
    expect(fill.style.animationPlayState).toBe('paused')

    // Letting go of a hold resumes, and is no tap.
    fireEvent.pointerUp(stage(), { clientX: 300, clientY: 400 })
    expect(kind()).toBe('intro')
    expect(screen.queryByText('Paused')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(screen.getByText('Paused')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(screen.queryByText('Paused')).toBeNull()
  })

  it('waits for the photo before the clock runs — but not for ever', () => {
    render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
    tap(0.8)
    tap(0.8)
    expect(screen.getByTestId('bestof-fill').style.animationPlayState).toBe('paused')
    fireEvent.load(document.querySelector('[data-kind="stage"]'))
    expect(screen.getByTestId('bestof-fill').style.animationPlayState).toBe('running')

    tap(0.1)
    act(() => vi.advanceTimersByTime(3100))
    expect(screen.getByTestId('bestof-fill').style.animationPlayState).toBe('running')
  })

  it('warms the next slides’ photos', () => {
    render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
    const urls = prefetchDecryptedMedia.mock.calls.map(([url]) => url)
    expect(urls).toEqual(expect.arrayContaining(['b-t', 'c-t']))
  })

  it('closes on the button, on escape, by swiping down and by tapping past the end', () => {
    const onClose = vi.fn()
    render(<BestOfViewer bestOf={BEST_OF} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.pointerDown(stage(), { clientX: 200, clientY: 100 })
    fireEvent.pointerUp(stage(), { clientX: 205, clientY: 400 })
    expect(onClose).toHaveBeenCalledTimes(3)

    for (let i = 0; i < 6; i++) tap(0.8)
    tap(0.8)
    expect(onClose).toHaveBeenCalledTimes(4)
  })

  it('starts over, and offers an admin to put it together again', () => {
    const onRemake = vi.fn()
    render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} onRemake={onRemake} />)
    for (let i = 0; i < 6; i++) tap(0.8)
    fireEvent.click(screen.getByRole('button', { name: 'Put it together again' }))
    expect(onRemake).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Watch again' }))
    expect(kind()).toBe('intro')
  })
})
