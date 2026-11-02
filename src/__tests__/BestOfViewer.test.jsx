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

// The music: a context that exists once something has unlocked it, sleeps
// that are only written down, and soundtracks that record what was asked of
// them. The device's music choice is the real one, in localStorage.
const audio = vi.hoisted(() => ({ context: null, soundtracks: [], sleeps: [] }))
vi.mock('../utils/audioContext', async (importOriginal) => ({
  ...(await importOriginal()),
  getAudioContext: () => audio.context,
  unlockAudio: () => {
    audio.context ??= { state: 'running' }
    return audio.context
  },
  resumeAudio: () => audio.context,
  suspendAudio: (afterMs) => audio.sleeps.push(afterMs),
}))
vi.mock('../utils/bestOfMusic', () => ({
  trackForMonth: () => 'warm',
  // 120 bpm: a beat is 500 ms.
  beatMs: () => 500,
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
import { LOOKS, TRANSITION_MS } from '../components/bestof/bestOfLooks'
import { STYLE_ORDER } from '../utils/bestOfStyle'

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
  audio.sleeps.length = 0
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

  it('moves on again from a slide it comes back to after its time ran out', () => {
    render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
    endClock()
    expect(kind()).toBe('count')
    tap(0.1)
    expect(kind()).toBe('intro')
    endClock()
    expect(kind()).toBe('count')
  })

  it('shows a slide stepped back to during the fade afresh, and waits for its photo again', () => {
    render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
    tapUntil('photo')
    const photo = current().querySelector('[data-kind="stage"]')
    fireEvent.load(photo)
    tap(0.8)
    tap(0.1)
    expect(kind()).toBe('photo')
    const again = current().querySelector('[data-kind="stage"]')
    expect(again).not.toBe(photo)
    expect(screen.getByTestId('bestof-fill').style.animationPlayState).toBe('paused')
    fireEvent.load(again)
    expect(screen.getByTestId('bestof-fill').style.animationPlayState).toBe('running')
  })

  it('plays on from a slide it steps to while paused', () => {
    render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(screen.getByText('Paused')).toBeInTheDocument()
    tap(0.8)
    expect(kind()).toBe('count')
    expect(screen.queryByText('Paused')).toBeNull()
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('holds the story and its music while the page is hidden', () => {
    audio.context = { state: 'running' }
    render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
    const [soundtrack] = audio.soundtracks
    act(() => vi.advanceTimersByTime(3100))
    expect(screen.getByTestId('bestof-fill').style.animationPlayState).toBe('running')
    const hide = (hidden) =>
      act(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
        document.dispatchEvent(new Event('visibilitychange'))
      })
    try {
      hide(true)
      expect(screen.getByTestId('bestof-fill').style.animationPlayState).toBe('paused')
      expect(soundtrack.pause).toHaveBeenCalled()
      hide(false)
      expect(screen.getByTestId('bestof-fill').style.animationPlayState).toBe('running')
      expect(soundtrack.resume).toHaveBeenCalled()
    } finally {
      delete document.hidden
    }
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

  it('gives a strip a collage’s time when it stands still for less motion', () => {
    const matchMedia = window.matchMedia
    window.matchMedia = (query) => ({
      matches: query.includes('prefers-reduced-motion'),
      addEventListener: () => {},
      removeEventListener: () => {},
    })
    try {
      const strip = { kind: 'collage', layout: 'strip', media: [media('f'), media('g'), media('h')], day: '2026-09-07' }
      render(<BestOfViewer bestOf={{ ...BEST_OF, slides: [BEST_OF.slides[0], strip, BEST_OF.slides.at(-1)] }} onClose={() => {}} />)
      tapUntil('collage')
      expect(current().querySelector('[data-layout]').dataset.layout).toBe('trio')
      expect(screen.getByTestId('bestof-fill').style.animation).toContain('6000ms')
    } finally {
      window.matchMedia = matchMedia
    }
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

    it('winds down once the story has reached its end, and stays down', () => {
      audio.context = { state: 'running' }
      render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
      tapUntil('outro')
      endClock()
      expect(audio.soundtracks[0].stop).toHaveBeenCalledWith({ fadeMs: expect.any(Number) })
      const { fadeMs } = audio.soundtracks[0].stop.mock.calls[0][0]
      expect(fadeMs).toBeGreaterThan(1000)
      // The context sleeps once the fade is over.
      expect(audio.sleeps.at(-1)).toBeGreaterThanOrEqual(fadeMs)

      // A key, or a click that bubbles to the stage, does not start it again.
      fireEvent.keyDown(window, { key: 'Tab' })
      fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
      expect(audio.soundtracks).toHaveLength(1)
    })

    it('lets the audio sleep once the story is closed', () => {
      audio.context = { state: 'running' }
      const { unmount } = render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
      expect(audio.sleeps).toEqual([])
      unmount()
      const { fadeMs } = audio.soundtracks[0].stop.mock.calls[0][0]
      expect(audio.sleeps.at(-1)).toBeGreaterThanOrEqual(fadeMs)
    })

    it('starts held when turned on while the story is held', () => {
      localStorage.setItem('kaydo_bestof_music', 'off')
      audio.context = { state: 'running' }
      render(<BestOfViewer bestOf={BEST_OF} onClose={() => {}} />)
      fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
      fireEvent.click(screen.getByRole('button', { name: 'Music on' }))
      expect(audio.soundtracks).toHaveLength(1)
      expect(audio.soundtracks[0].pause).toHaveBeenCalled()
    })
  })

  describe('looks', () => {
    const styled = (style) => ({ ...BEST_OF, style })
    // The slides on stage, not what the look lays over them.
    const leavingCount = () => stage().querySelectorAll(':scope > div.absolute.inset-0:not(.z-10)').length
    const controls = () => screen.getByText('Best of September').parentElement

    it('has the classic look without a style, or with one it does not know', () => {
      for (const style of [undefined, 'someday-a-new-style']) {
        render(<BestOfViewer bestOf={styled(style)} onClose={() => {}} />)
        expect(screen.getByText('SEP')).toBeInTheDocument()
        expect(stage().style.getPropertyValue('--bo-dark')).toBe(LOOKS.classic.colors.dark)
        tap(0.8)
        expect(current().className).toContain('bestof-enter-fade')
        cleanup()
      }
    })

    it.each(STYLE_ORDER)('opens and plays a best-of in the %s look', (style) => {
      const look = LOOKS[style]
      render(<BestOfViewer bestOf={styled(style)} onClose={() => {}} />)
      expect(stage().dataset.style).toBe(style)
      expect(stage().style.getPropertyValue('--bo-accent')).toBe(look.colors.accent)
      expect(kind()).toBe('intro')
      // Every opening card names the month, one way or another.
      expect(within(current()).queryAllByText(/^(SEP|September|September 2026)$/).length).toBeGreaterThan(0)

      tap(0.8)
      expect(kind()).toBe('count')
      expect(current().className).toContain(`bestof-enter-${look.transition}`)
      expect(current().style.animationDuration).toBe(`${TRANSITION_MS[look.transition]}ms`)
      // The slide being left stays until the look's transition is over.
      act(() => vi.advanceTimersByTime(TRANSITION_MS[look.transition] - 100))
      expect(leavingCount()).toBe(2)
      act(() => vi.advanceTimersByTime(200))
      expect(leavingCount()).toBe(1)

      tapUntil('outro')
      expect(current().querySelector('[data-outro]').dataset.outro).toBe(look.outro)
    })

    it('frames a film in black bars, and keeps its controls white on its dark cards', () => {
      render(<BestOfViewer bestOf={styled('cinema')} onClose={() => {}} />)
      expect(screen.getByTestId('bestof-letterbox')).toBeInTheDocument()
      tapUntil('count')
      expect(controls().className).toContain('text-white')
      cleanup()
      render(<BestOfViewer bestOf={styled('polaroid')} onClose={() => {}} />)
      expect(screen.queryByTestId('bestof-letterbox')).toBeNull()
      tapUntil('count')
      expect(controls().className).not.toContain('text-white')
    })

    it('throws confetti for an award in the festival look, and nowhere else', () => {
      render(<BestOfViewer bestOf={styled('festival')} onClose={() => {}} />)
      tapUntil('awardIntro')
      expect(screen.queryByTestId('bestof-confetti')).toBeNull()
      tap(0.8)
      expect(kind()).toBe('award')
      expect(screen.getByTestId('bestof-confetti')).toBeInTheDocument()
      cleanup()
      render(<BestOfViewer bestOf={styled('magazine')} onClose={() => {}} />)
      tapUntil('award')
      expect(screen.queryByTestId('bestof-confetti')).toBeNull()
    })

    it('lays the diary’s paper over its light cards only', () => {
      render(<BestOfViewer bestOf={styled('diary')} onClose={() => {}} />)
      expect(stage().querySelector('.bestof-paper')).toBeNull()
      expect(screen.getByTestId('bestof-calendar')).toBeInTheDocument()
      tap(0.8)
      expect(kind()).toBe('count')
      expect(stage().querySelector('.bestof-paper')).not.toBeNull()
      tap(0.8)
      expect(stage().querySelector('.bestof-paper')).toBeNull()
    })
  })

  describe('extra cards', () => {
    const CARDS = {
      ...BEST_OF,
      style: 'magazine',
      slides: [
        { kind: 'intro', media: [media('a')] },
        { kind: 'calendar', days: [3, 4, 20] },
        { kind: 'rhythm', fact: 'evening', percent: 64, media: media('b') },
        { kind: 'places', places: [{ place: 'Zell am See', entries: 3 }, { place: 'Home', entries: 1 }], media: [media('c'), media('d')] },
        { kind: 'bookends', media: [media('e'), media('f')], days: ['2026-09-01', '2026-09-30'], captions: ['', ''] },
        { kind: 'awardIntro', award: 'streak', media: media('g') },
        { kind: 'award', award: 'streak', media: media('g'), from: '2026-09-07', to: '2026-09-11', days: 5 },
        { kind: 'award', award: 'weekend', media: media('h'), from: '2026-09-05', to: '2026-09-06', count: 9 },
        { kind: 'award', award: 'theme', media: media('i'), theme: 'Garden', entries: 4 },
        { kind: 'yearAgo', month: '2025-09', photos: 14, videos: 0, media: [media('j'), media('k')] },
        { kind: 'outro', media: [media('a')] },
      ],
    }

    it('shows the calendar, the rhythm, the places and the first and last moment', () => {
      render(<BestOfViewer bestOf={CARDS} onClose={() => {}} />)
      tap(0.8)
      expect(kind()).toBe('calendar')
      expect(within(current()).getByText('On 3 of 30 days')).toBeInTheDocument()
      expect(current().querySelectorAll('[data-kept]')).toHaveLength(3)
      // A light card: the controls go dark.
      expect(screen.getByText('Best of September').parentElement.className).not.toContain('text-white')

      tap(0.8)
      expect(within(current()).getByText('The evenings were yours')).toBeInTheDocument()
      expect(within(current()).getByText('64%')).toBeInTheDocument()
      expect(within(current()).getByText('of your moments')).toBeInTheDocument()

      tap(0.8)
      expect(within(current()).getByText('Where you were')).toBeInTheDocument()
      expect(within(current()).getByText('Zell am See')).toBeInTheDocument()
      expect(within(current()).getByText('3 moments')).toBeInTheDocument()

      tap(0.8)
      expect(within(current()).getByText('This is how September began…')).toBeInTheDocument()
      expect(within(current()).getByText('…and how it ended')).toBeInTheDocument()
    })

    it('announces and shows the new awards', () => {
      render(<BestOfViewer bestOf={CARDS} onClose={() => {}} />)
      tapUntil('awardIntro')
      expect(within(current()).getByText('and the longest streak of the month was…')).toBeInTheDocument()
      tap(0.8)
      expect(within(current()).getByText('Longest streak')).toBeInTheDocument()
      expect(within(current()).getByText('5 days in a row')).toBeInTheDocument()
      tap(0.8)
      expect(within(current()).getByText('Weekend of the month')).toBeInTheDocument()
      expect(within(current()).getByText('9 photos and videos that weekend')).toBeInTheDocument()
      tap(0.8)
      expect(within(current()).getByText('Theme of the month')).toBeInTheDocument()
      expect(within(current()).getByText('Garden')).toBeInTheDocument()
    })

    it('looks back at the same month a year before', () => {
      render(<BestOfViewer bestOf={CARDS} onClose={() => {}} />)
      tapUntil('yearAgo')
      expect(within(current()).getByText('A year ago…')).toBeInTheDocument()
      expect(within(current()).getByText('September 2025 · 14 photos')).toBeInTheDocument()
    })
  })
})
