/* The best-of, played as a story (components/bestof/BestOfViewer.jsx).

   Its clock is the progress bar's fill animation, which jsdom never runs, so
   the tests end it by hand: that is exactly the event the viewer listens to.
   The media components and the music are stand-ins; decrypting and playing
   are theirs to test (bestOfMusic.test.js, BestOfCollage.test.jsx). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react'

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

// The music: a context that exists once something has unlocked it, and
// soundtracks that record what was asked of them.
const audio = vi.hoisted(() => ({ context: null, soundtracks: [] }))
vi.mock('../utils/audioContext', () => ({
  getAudioContext: () => audio.context,
  unlockAudio: () => {
    audio.context ??= { state: 'running' }
    return audio.context
  },
}))
vi.mock('../utils/bestOfMusic', () => ({
  trackForMonth: () => 'warm',
  // 120 bpm: a beat is 500 ms.
  barMs: () => 2000,
  createSoundtrack: (context, track) => {
    const soundtrack = {
      track,
      start: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    }
    audio.soundtracks.push(soundtrack)
    return soundtrack
  },
}))

import BestOfViewer from '../components/bestof/BestOfViewer'

const media = (url) => ({ url, thumbUrl: `${url}-t` })

const BEST_OF = {
  version: 1,
  month: '2026-09',
  cover: media('a'),
  slides: [
    { kind: 'intro', media: [media('a'), media('b')] },
    { kind: 'count', photos: 12, videos: 1, media: media('b') },
    { kind: 'photo', media: media('c'), caption: 'At the lake', location: 'Zell am See', day: '2026-09-06', motion: 'panLeft' },
    { kind: 'collage', layout: 'duo', media: [media('f'), media('g')], caption: 'Sunday baking', location: 'Home', day: '2026-09-07' },
    { kind: 'video', media: { url: 'clip' }, caption: 'Splash', day: '2026-09-07' },
    { kind: 'awardIntro', award: 'place', media: media('d') },
    { kind: 'award', award: 'place', media: media('d'), place: 'Zell am See', entries: 3 },
    { kind: 'someday-a-new-kind', media: media('e') },
    { kind: 'outro', media: [media('a')] },
  ],
}
const KNOWN_SLIDES = BEST_OF.slides.length - 1

const stage = () => screen.getByTestId('bestof-stage')
const current = () => document.querySelector('[data-testid^="bestof-slide-"]')
const kind = () => current().dataset.testid.replace('bestof-slide-', '')
// jsdom has no AnimationEvent, so React listens for the prefixed name there.
const endClock = () =>
  act(() => {
    screen.getByTestId('bestof-fill').dispatchEvent(new Event('webkitAnimationEnd', { bubbles: true }))
  })

// A tap: down, up and the click that follows, at a share of the stage's width.
function tap(share) {
  const el = stage()
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 800, right: 400, bottom: 800 })
  const at = { clientX: 400 * share, clientY: 400 }
  fireEvent.pointerDown(el, at)
  fireEvent.pointerUp(el, at)
  fireEvent.click(el, at)
}

function tapUntil(target) {
  for (let i = 0; i < 20 && kind() !== target; i++) tap(0.8)
  expect(kind()).toBe(target)
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  prefetchDecryptedMedia.mockClear()
  audio.context = null
  audio.soundtracks.length = 0
  localStorage.clear()
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
    expect(within(current()).getByText('photos and videos')).toBeInTheDocument()

    tap(0.8)
    expect(kind()).toBe('photo')
    expect(within(current()).getByText('At the lake')).toBeInTheDocument()
    expect(within(current()).getByText('Sep 6 · Zell am See')).toBeInTheDocument()

    tap(0.1)
    expect(kind()).toBe('count')
  })

  it('times its slides in beats of the month’s music', () => {
    render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
    // The opening card is eight beats: 4 s at 120 bpm.
    expect(screen.getByTestId('bestof-fill').style.animation).toContain('4000ms')
    tapUntil('collage')
    expect(screen.getByTestId('bestof-fill').style.animation).toContain('6000ms')
  })

  it('gives a film strip the time its last frame needs to come in', () => {
    const strip = { kind: 'collage', layout: 'strip', media: [media('f'), media('g'), media('h')], day: '2026-09-07' }
    render(<BestOfViewer bestOf={{ ...BEST_OF, slides: [BEST_OF.slides[0], strip, BEST_OF.slides.at(-1)] }} onClose={() => {}} />)
    tapUntil('collage')
    expect(screen.getByTestId('bestof-fill').style.animation).toContain('7000ms')
  })

  it('fades one slide into the next, keeping the one being left until it has', () => {
    render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
    tap(0.8)
    // Two slides on stage: the count fading in over the opening card.
    expect(stage().querySelectorAll(':scope > div.absolute.inset-0')).toHaveLength(2)
    expect(current().className).toContain('bestof-enter')
    act(() => vi.advanceTimersByTime(600))
    expect(stage().querySelectorAll(':scope > div.absolute.inset-0')).toHaveLength(1)
  })

  it('shows a collage of an album', () => {
    render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
    tapUntil('collage')
    expect(within(current()).getByText('Sunday baking')).toBeInTheDocument()
  })

  it('plays a clip to its end rather than on a clock, muted under the music', () => {
    render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
    tapUntil('video')
    expect(screen.queryByTestId('bestof-fill')).toBeNull()
    // Its last timeupdate reaches the end, and then it ends — before React has
    // rendered in between, as a browser may: one step, not two.
    const clip = current().querySelector('[data-kind="video"]')
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
    tapUntil('awardIntro')
    expect(within(current()).getByText('and the place of the month is…')).toBeInTheDocument()
    tap(0.8)
    expect(kind()).toBe('award')
    expect(within(current()).getByText('Place of the month')).toBeInTheDocument()
    expect(within(current()).getByText('Zell am See')).toBeInTheDocument()
  })

  it('leaves out slides it does not know, and stays on the last one', () => {
    render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
    expect(document.querySelectorAll('[aria-hidden="true"] > span.flex-1')).toHaveLength(KNOWN_SLIDES)
    tapUntil('outro')
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
    tapUntil('photo')
    expect(screen.getByTestId('bestof-fill').style.animationPlayState).toBe('paused')
    fireEvent.load(current().querySelector('[data-kind="stage"]'))
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

    tapUntil('outro')
    tap(0.8)
    expect(onClose).toHaveBeenCalledTimes(4)
  })

  it('starts over, and offers an admin to put it together again', () => {
    const onRemake = vi.fn()
    render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} onRemake={onRemake} />)
    tapUntil('outro')
    fireEvent.click(screen.getByRole('button', { name: 'Put it together again' }))
    expect(onRemake).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Watch again' }))
    expect(kind()).toBe('intro')
  })

  describe('music', () => {
    it('plays the month’s track when the tap that opened the story unlocked sound', () => {
      audio.context = { state: 'running' }
      const { unmount } = render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
      expect(audio.soundtracks).toHaveLength(1)
      expect(audio.soundtracks[0].track).toBe('warm')
      expect(audio.soundtracks[0].start).toHaveBeenCalled()

      unmount()
      expect(audio.soundtracks[0].stop).toHaveBeenCalled()
    })

    it('starts silent from a notification, and the first tap brings the music', () => {
      render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
      expect(audio.soundtracks).toHaveLength(0)
      // Nothing plays yet, and the button says so.
      expect(screen.getByRole('button', { name: 'Music on' })).toBeInTheDocument()

      tap(0.8)
      expect(audio.soundtracks).toHaveLength(1)
      expect(audio.soundtracks[0].start).toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Music off' })).toBeInTheDocument()
      // Later taps do not start a second one.
      tap(0.8)
      expect(audio.soundtracks).toHaveLength(1)
    })

    it('holds the music while the story is held', () => {
      audio.context = { state: 'running' }
      render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
      const [soundtrack] = audio.soundtracks
      fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
      expect(soundtrack.pause).toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Play' }))
      expect(soundtrack.resume).toHaveBeenCalled()
    })

    it('turns off on its button, stays off, and is remembered on the device', () => {
      audio.context = { state: 'running' }
      const { unmount } = render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
      fireEvent.click(screen.getByRole('button', { name: 'Music off' }))
      expect(audio.soundtracks[0].stop).toHaveBeenCalled()
      // The click does not reach the stage, which would start it again.
      expect(audio.soundtracks).toHaveLength(1)
      tap(0.8)
      expect(audio.soundtracks).toHaveLength(1)
      unmount()

      render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
      expect(audio.soundtracks).toHaveLength(1)
      fireEvent.click(screen.getByRole('button', { name: 'Music on' }))
      expect(audio.soundtracks).toHaveLength(2)
    })

    it('winds down once the story has reached its end', () => {
      audio.context = { state: 'running' }
      render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
      tapUntil('outro')
      endClock()
      expect(audio.soundtracks[0].stop).toHaveBeenCalledWith({ fadeMs: expect.any(Number) })
      expect(audio.soundtracks[0].stop.mock.calls[0][0].fadeMs).toBeGreaterThan(1000)
    })
  })
})
