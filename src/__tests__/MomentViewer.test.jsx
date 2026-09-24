/* The story viewer.

   docs/moments-decryption.md §2: tapping a story circle started a cold download
   of the full original — up to the 10 MB upload cap — while the 1024px copy of
   the same photo sat decrypted in the media cache. The story opens on the
   thumbnail; the original follows (CrossfadeImage.test.jsx covers that part).

   And moving through a story flickered: a black frame on every switch (also
   CrossfadeImage), and one frame of the previous slide's progress bar and info
   card before they reset, because the reset ran in an effect after paint. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act, fireEvent } from '@testing-library/react'

const h = vi.hoisted(() => ({ stage: null, commits: [] }))

const prefetchDecryptedMedia = vi.fn(async () => 'blob:decrypted')
vi.mock('../components/media/useDecryptedMedia', () => ({
  prefetchDecryptedMedia: (...args) => prefetchDecryptedMedia(...args),
}))
// The stage, as data attributes, plus a record of what the rest of the viewer
// showed in the very commit that put each slide on screen — read in a layout
// effect, so before the browser paints and before any passive effect runs.
vi.mock('../components/media/CrossfadeImage', async () => {
  const { useLayoutEffect } = await import('react')
  return {
    default: function Stage(props) {
      h.stage = props
      useLayoutEffect(() => {
        h.commits.push({
          src: props.src,
          fills: Array.from(document.querySelectorAll('[data-testid="progress-fill"]')).map((el) => el.style.width),
          infoCard: !!document.querySelector('[aria-label="Hide info"]'),
        })
      }, [props.src])
      return (
        <div
          data-kind="stage"
          data-src={props.src}
          data-thumb={props.thumbSrc ?? ''}
          data-tiny={props.tinyPreview ?? ''}
          data-hold={String(!!props.hold)}
        >
          {props.children}
        </div>
      )
    },
  }
})
vi.mock('../components/media/EncryptedVideo', () => ({
  default: ({ src, onLoadedData, style, ref, className }) => (
    <video
      ref={ref}
      data-kind="video"
      data-src={src}
      className={className}
      onLoadedData={onLoadedData}
      style={style}
    />
  ),
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

const stages = () => Array.from(document.querySelectorAll('[data-kind="stage"]'))
const onScreen = () => h.stage.src
const settle = () => act(() => h.stage.onSettled(h.stage.src))
const next = () => act(() => { fireEvent.keyDown(window, { key: 'ArrowRight' }) })
const noop = () => {}

function setDesktop(matches) {
  window.matchMedia = matches
    ? (query) => ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} })
    : undefined
}

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom has no media playback.
  HTMLMediaElement.prototype.pause = vi.fn()
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve())
  prefetchDecryptedMedia.mockImplementation(async () => 'blob:decrypted')
  auth.encryptionKey = { fake: 'key' }
  h.stage = null
  h.commits = []
  setDesktop(false)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  setDesktop(false)
})

describe('what the story viewer shows', () => {
  it('opens a photo on its thumbnail, with the original named for later', () => {
    render(<MomentViewer moments={[moment('a')]} initialIndex={0} onClose={noop} />)

    const [stage] = stages()
    expect(stage.getAttribute('data-src')).toBe('https://cdn/a-0.enc')
    expect(stage.getAttribute('data-thumb')).toBe('https://cdn/a-0-thumb.enc')
  })

  it('carries the blur-up preview so the wait shows the photo, not a spinner', () => {
    render(<MomentViewer moments={[moment('a')]} initialIndex={0} onClose={noop} />)
    expect(stages()[0].getAttribute('data-tiny')).toBe('data:image/webp;base64,a0')
  })

  it('goes straight to the original when the moment has no thumbnail', () => {
    render(<MomentViewer moments={[moment('a', 1, { thumbs: false })]} initialIndex={0} onClose={noop} />)
    expect(stages()[0].getAttribute('data-thumb')).toBe('')
    expect(stages()[0].getAttribute('data-src')).toBe('https://cdn/a-0.enc')
  })

  it('keeps ciphertext previews out of the element', () => {
    // A moment whose thumbsTiny never got decrypted — the read path this file's
    // sibling test covers. tinyPreviewAt refuses anything that is not a data URL.
    const raw = { ...moment('a'), thumbsTiny: ['kZ8fQ2t+Xy9abCDEF/ghIJKLmnop=='] }
    render(<MomentViewer moments={[raw]} initialIndex={0} onClose={noop} />)
    expect(stages()[0].getAttribute('data-tiny')).toBe('')
  })

  it('mounts one layout, not both with one hidden', () => {
    // The hidden copy decoded every photo twice and played every clip twice.
    render(<MomentViewer moments={[moment('a')]} initialIndex={0} onClose={noop} />)
    expect(stages()).toHaveLength(1)
    cleanup()

    setDesktop(true)
    render(<MomentViewer moments={[moment('a')]} initialIndex={0} onClose={noop} />)
    expect(stages()).toHaveLength(1)
    expect(document.querySelector('button[aria-label="Next"]').className).toContain('rounded-full')
  })

  it('keeps the photo up under a clip until the clip has a frame', () => {
    const withVideo = { ...moment('a'), videos: [{ url: 'https://cdn/a-clip.enc' }] }
    render(<MomentViewer moments={[withVideo]} initialIndex={0} onClose={noop} />)
    next()

    const video = document.querySelector('[data-kind="video"]')
    expect(stages()[0].getAttribute('data-src')).toBe('')
    expect(stages()[0].getAttribute('data-hold')).toBe('true')
    expect(video.style.opacity).toBe('0')

    fireEvent.loadedData(video)
    expect(stages()[0].getAttribute('data-hold')).toBe('false')
    expect(video.style.opacity).toBe('1')
  })

  it('waits for the clip’s frame again when coming back to it', () => {
    const withVideo = { ...moment('a'), videos: [{ url: 'https://cdn/a-clip.enc' }] }
    render(<MomentViewer moments={[withVideo, moment('b')]} initialIndex={0} onClose={noop} />)
    next()
    fireEvent.loadedData(document.querySelector('[data-kind="video"]'))
    next()
    // Covered by the next photo, so the clip is gone by the time we come back.
    act(() => h.stage.onShown('https://cdn/b-0.enc'))
    act(() => { fireEvent.keyDown(window, { key: 'ArrowLeft' }) })

    // A new element with no frame yet: the stage holds, the clip stays unseen.
    expect(stages()[0].getAttribute('data-hold')).toBe('true')
    expect(document.querySelector('[data-kind="video"]').style.opacity).toBe('0')
  })
})

describe('pausing a clip', () => {
  const withVideo = () => ({ ...moment('a'), videos: [{ url: 'https://cdn/a-clip.enc' }] })

  it('pauses the clip on screen while the story is held', () => {
    // Both layouts used to be mounted and the ref landed on the hidden desktop
    // clip, so holding a story on a phone paused a video nobody could see.
    render(<MomentViewer moments={[withVideo()]} initialIndex={0} onClose={noop} />)
    next()
    const video = document.querySelector('[data-kind="video"]')
    fireEvent.pointerDown(stages()[0])
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
    expect(HTMLMediaElement.prototype.pause.mock.contexts.at(-1)).toBe(video)
  })

  it('leaves a press on the clip itself to the clip’s own controls', () => {
    // They pause and resume on click. Pausing here as well meant the release
    // resumed it and the click paused it again, for good.
    render(<MomentViewer moments={[withVideo()]} initialIndex={0} onClose={noop} />)
    next()
    HTMLMediaElement.prototype.pause.mockClear()
    fireEvent.pointerDown(document.querySelector('[data-kind="video"]'))
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled()
  })
})

describe('leaving a clip', () => {
  const withVideo = () => ({ ...moment('a'), videos: [{ url: 'https://cdn/a-clip.enc' }] })
  const clips = () => Array.from(document.querySelectorAll('[data-kind="video"]'))

  it('keeps it up, paused, beneath the next photo until that photo has faded in', () => {
    // Unmounting it at once cut to the dark background while the photo decoded.
    render(<MomentViewer moments={[withVideo(), moment('b')]} initialIndex={0} onClose={noop} />)
    next()
    const clip = clips()[0]
    fireEvent.loadedData(clip)
    HTMLMediaElement.prototype.pause.mockClear()

    next()
    expect(clips()).toEqual([clip])
    expect(HTMLMediaElement.prototype.pause.mock.contexts).toContain(clip)
    // Beneath the stage's photos, not above them like the clip being played.
    expect(clip.className).not.toContain('z-10')
    expect(clip.className).toContain('pointer-events-none')

    act(() => h.stage.onShown('https://cdn/b-0.enc'))
    expect(clips()).toEqual([])
  })

  it('does not hold a clip that never had a frame to hold', () => {
    render(<MomentViewer moments={[withVideo(), moment('b')]} initialIndex={0} onClose={noop} />)
    next()
    next()
    expect(clips()).toEqual([])
  })

  it('takes the clip back, not a copy, when coming straight back to it', () => {
    render(<MomentViewer moments={[withVideo(), moment('b')]} initialIndex={0} onClose={noop} />)
    next()
    const clip = clips()[0]
    fireEvent.loadedData(clip)
    // jsdom never loads media; a real clip that played has its frame.
    Object.defineProperty(clip, 'readyState', { value: 4 })
    next()
    act(() => { fireEvent.keyDown(window, { key: 'ArrowLeft' }) })

    expect(clips()).toEqual([clip])
    expect(clip.style.opacity).toBe('1')
    expect(clip.className).toContain('z-10')
  })
})

describe('moving between slides', () => {
  it('shows the new slide with its progress bar already reset — no frame of the old one', () => {
    vi.useFakeTimers()
    render(<MomentViewer moments={[moment('a', 2), moment('b')]} initialIndex={0} onClose={noop} />)
    settle()
    act(() => vi.advanceTimersByTime(2000))

    next()
    const commit = h.commits.find((c) => c.src === 'https://cdn/a-1.enc')
    expect(commit.fills).toEqual(['100%', '0%'])
  })

  it('brings a hidden info card back in the same commit as the new moment', () => {
    render(<MomentViewer moments={[moment('a'), moment('b')]} initialIndex={0} onClose={noop} />)
    fireEvent.click(document.querySelector('[aria-label="Hide info"]'))
    expect(document.querySelector('[aria-label="Hide info"]')).toBeNull()

    next()
    const commit = h.commits.find((c) => c.src === 'https://cdn/b-0.enc')
    expect(commit.infoCard).toBe(true)
  })

  it('starts the clock when the photo is on screen, not when the slide opens', () => {
    vi.useFakeTimers()
    render(<MomentViewer moments={[moment('a', 2)]} initialIndex={0} onClose={noop} />)

    // A slow download: the story must not move on without ever showing it.
    act(() => vi.advanceTimersByTime(6000))
    expect(onScreen()).toBe('https://cdn/a-0.enc')

    settle()
    act(() => vi.advanceTimersByTime(4900))
    expect(onScreen()).toBe('https://cdn/a-0.enc')
    act(() => vi.advanceTimersByTime(200))
    expect(onScreen()).toBe('https://cdn/a-1.enc')
  })
})

describe('what the story viewer warms next', () => {
  const warmed = () => prefetchDecryptedMedia.mock.calls.map(([url]) => url)

  it('warms the next two taps and the next moment, as thumbnails', async () => {
    await act(async () => {
      render(<MomentViewer moments={[moment('a', 5), moment('b')]} initialIndex={0} onClose={noop} />)
    })

    expect(warmed()).toEqual([
      'https://cdn/a-1-thumb.enc',
      'https://cdn/a-2-thumb.enc',
      'https://cdn/b-0-thumb.enc',
    ])
  })

  it('does not warm the rest of a long moment ahead of what a tap reaches', async () => {
    // Warming all of it put the next photo behind the rest of the batch.
    await act(async () => {
      render(<MomentViewer moments={[moment('a', 5)]} initialIndex={0} onClose={noop} />)
    })
    expect(warmed()).not.toContain('https://cdn/a-3-thumb.enc')
    expect(warmed()).not.toContain('https://cdn/a-4-thumb.enc')
  })

  it('warms where a tap back and a swipe back land in the previous moment', async () => {
    await act(async () => {
      render(<MomentViewer moments={[moment('a', 3), moment('b')]} initialIndex={1} onClose={noop} />)
    })
    // A tap back lands on the last photo, a swipe back on the first.
    expect(warmed()).toContain('https://cdn/a-2-thumb.enc')
    expect(warmed()).toContain('https://cdn/a-0-thumb.enc')
  })

  it('never warms an original — a slide fetches its own once it is looked at', async () => {
    await act(async () => {
      render(<MomentViewer moments={[moment('a', 3), moment('b', 2)]} initialIndex={0} onClose={noop} />)
    })
    expect(warmed().filter((u) => !u.includes('-thumb'))).toEqual([])
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
