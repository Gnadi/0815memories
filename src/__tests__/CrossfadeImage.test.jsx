/* The story viewer's picture area. Tapping from one photo to the next showed a
   black frame every time — the viewer swapped one <img>'s src, and the browser
   drops the old picture before it has decoded the new one — then flashed again
   when the thumbnail was swapped for the original.

   CrossfadeImage keeps whatever is on screen until its replacement has decoded,
   then fades the new one in over it. These tests hold decodes and downloads open
   so the in-between states — the ones that used to be black — can be looked at. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'

const h = vi.hoisted(() => ({
  media: new Map(), // encrypted URL -> { url } | { error }
  listeners: new Set(),
  version: 0,
  prefetch: null,
  retain: null,
}))

// A stand-in for the decrypt hook whose results the test hands out: `land()`
// plays the part of a download finishing, and re-renders whoever asked.
vi.mock('../components/media/useDecryptedMedia', async () => {
  const { useSyncExternalStore } = await import('react')
  const subscribe = (cb) => {
    h.listeners.add(cb)
    return () => h.listeners.delete(cb)
  }
  function useDecryptedMedia(u) {
    useSyncExternalStore(subscribe, () => h.version)
    const m = u ? h.media.get(u) : null
    return { decryptedUrl: m?.url ?? null, loading: !!u && !m, error: m?.error ?? null, ref: () => {} }
  }
  return {
    default: useDecryptedMedia,
    peekDecryptedMedia: (u) => (u?.startsWith('data:') ? u : h.media.get(u)?.url ?? null),
    prefetchDecryptedMedia: (...args) => h.prefetch(...args),
    retainDecryptedMedia: (...args) => h.retain(...args),
  }
})
const KEY = { fake: 'key' }
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ encryptionKey: KEY }) }))

import CrossfadeImage, { FADE_MS, ORIGINAL_DWELL_MS } from '../components/media/CrossfadeImage'

function land(encryptedUrl, value) {
  act(() => {
    h.media.set(encryptedUrl, value)
    h.version += 1
    for (const l of h.listeners) l()
  })
}

// Decodes finish when the test says so.
let decodes
async function decoded(src) {
  const resolve = decodes.get(src)
  if (!resolve) throw new Error(`nothing is decoding ${src}`)
  await act(async () => resolve())
}

const layers = () =>
  Array.from(document.querySelectorAll('img')).map((img) => `${img.getAttribute('src')} ${img.style.opacity}`)
const waiting = () => !!document.querySelector('[data-testid="crossfade-waiting"]')

beforeEach(() => {
  vi.useFakeTimers()
  h.media.clear()
  h.prefetch = vi.fn(() => new Promise(() => {}))
  h.retain = vi.fn(() => vi.fn())
  decodes = new Map()
  HTMLImageElement.prototype.decode = function decode() {
    return new Promise((resolve) => decodes.set(this.getAttribute('src'), resolve))
  }
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  delete HTMLImageElement.prototype.decode
})

async function showA(props = {}) {
  land('a-thumb', { url: 'blob:a-thumb' })
  const view = render(<CrossfadeImage src="a" thumbSrc="a-thumb" {...props} />)
  await decoded('blob:a-thumb')
  return view
}

describe('switching photos', () => {
  it('keeps the previous photo up until the next one has decoded, then fades it in over it', async () => {
    const { rerender } = await showA()
    expect(layers()).toEqual(['blob:a-thumb 1'])

    land('b-thumb', { url: 'blob:b-thumb' })
    rerender(<CrossfadeImage src="b" thumbSrc="b-thumb" />)
    // The frame that used to be black: a is still fully up, b waits unseen.
    expect(layers()).toEqual(['blob:a-thumb 1', 'blob:b-thumb 0'])

    await decoded('blob:b-thumb')
    expect(layers()).toEqual(['blob:a-thumb 1', 'blob:b-thumb 1'])

    // Once b has faded in, nothing can see a any more.
    act(() => vi.advanceTimersByTime(FADE_MS + 50))
    expect(layers()).toEqual(['blob:b-thumb 1'])
  })

  it('shows the blur-up while the thumbnail is on its way, and the thumbnail over it once it lands', async () => {
    const { rerender } = await showA()

    rerender(<CrossfadeImage src="b" thumbSrc="b-thumb" tinyPreview="data:b-tiny" />)
    await decoded('data:b-tiny')
    expect(layers()).toEqual(['blob:a-thumb 1', 'data:b-tiny 1'])
    expect(document.querySelectorAll('img')[1].style.filter).toBe('blur(12px)')

    land('b-thumb', { url: 'blob:b-thumb' })
    await decoded('blob:b-thumb')
    expect(layers()).toEqual(['blob:a-thumb 1', 'data:b-tiny 1', 'blob:b-thumb 1'])
  })

  it('holds the previous photo, with the wait state over it, when there is nothing to show yet', async () => {
    const { rerender } = await showA()
    expect(waiting()).toBe(false)

    // An older moment: no blur-up on the document, thumbnail not in memory.
    rerender(<CrossfadeImage src="b" thumbSrc="b-thumb" />)
    expect(layers()).toEqual(['blob:a-thumb 1'])
    expect(waiting()).toBe(true)

    land('b-thumb', { url: 'blob:b-thumb' })
    await decoded('blob:b-thumb')
    expect(waiting()).toBe(false)
  })

  it('never lets a photo that was skipped past fade in later', async () => {
    const { rerender } = await showA()

    land('b-thumb', { url: 'blob:b-thumb' })
    rerender(<CrossfadeImage src="b" thumbSrc="b-thumb" />)
    rerender(<CrossfadeImage src="c" thumbSrc="c-thumb" />)
    expect(layers()).toEqual(['blob:a-thumb 1'])

    // b's decode finishing now must not put it on screen under c.
    await decoded('blob:b-thumb')
    expect(layers()).toEqual(['blob:a-thumb 1'])
  })

  it('clears a slide that failed rather than leaving the previous photo in its place', async () => {
    const onSettled = vi.fn()
    const { rerender } = await showA({ onSettled })

    land('b-thumb', { error: new Error('Decryption failed') })
    rerender(<CrossfadeImage src="b" thumbSrc="b-thumb" onSettled={onSettled} />)
    expect(layers()).toEqual([])
    // Settled, so the story's clock is not left waiting forever.
    expect(onSettled).toHaveBeenLastCalledWith('b')
  })

  it('holds the photo under a clip until it has a frame, and clears once the clip has faded in', async () => {
    const { rerender } = await showA()

    rerender(<CrossfadeImage src="" hold />)
    act(() => vi.advanceTimersByTime(5000))
    expect(layers()).toEqual(['blob:a-thumb 1'])

    // The clip has a frame and starts to fade in: the photo stays under it
    // until it has, or the fade would start from black.
    rerender(<CrossfadeImage src="" />)
    act(() => vi.advanceTimersByTime(FADE_MS))
    expect(layers()).toEqual(['blob:a-thumb 1'])
    act(() => vi.advanceTimersByTime(50))
    expect(layers()).toEqual([])
  })
})

describe('what sits beneath the photos', () => {
  it('keeps children under the layers, and says when a photo has fully covered them', async () => {
    const onShown = vi.fn()
    land('a-thumb', { url: 'blob:a-thumb' })
    render(
      <CrossfadeImage src="a" thumbSrc="a-thumb" onShown={onShown}>
        <video data-testid="leaving" />
      </CrossfadeImage>,
    )
    const stage = document.querySelector('[data-testid="leaving"]').parentElement
    expect(stage.firstElementChild.getAttribute('data-testid')).toBe('leaving')
    expect(stage.className).toContain('isolate')

    await decoded('blob:a-thumb')
    // Decoded is not covered: the photo is still fading in over it.
    act(() => vi.advanceTimersByTime(FADE_MS))
    expect(onShown).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(50))
    expect(onShown).toHaveBeenCalledWith('a')
  })
})

describe('telling the viewer when the photo is up', () => {
  it('settles on the thumbnail, not on the blur-up', async () => {
    const onSettled = vi.fn()
    render(<CrossfadeImage src="a" thumbSrc="a-thumb" tinyPreview="data:a-tiny" onSettled={onSettled} />)
    await decoded('data:a-tiny')
    expect(onSettled).not.toHaveBeenCalled()

    land('a-thumb', { url: 'blob:a-thumb' })
    await decoded('blob:a-thumb')
    expect(onSettled).toHaveBeenCalledWith('a')
  })
})

describe('the full original', () => {
  it('is fetched once the slide has been looked at for a moment, not when it opens', async () => {
    await showA()
    act(() => vi.advanceTimersByTime(ORIGINAL_DWELL_MS - 1))
    expect(h.prefetch).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(h.prefetch).toHaveBeenCalledWith('a', KEY, 'image/*')
  })

  it('is not fetched for a slide that was only tapped past', async () => {
    const { rerender } = await showA()
    land('b-thumb', { url: 'blob:b-thumb' })
    rerender(<CrossfadeImage src="b" thumbSrc="b-thumb" />)
    act(() => vi.advanceTimersByTime(5000))
    expect(h.prefetch.mock.calls.map(([u]) => u)).not.toContain('a')
  })

  it('fades in over the thumbnail when it lands', async () => {
    let finish
    h.prefetch = vi.fn(() => new Promise((r) => { finish = r }))
    await showA()
    act(() => vi.advanceTimersByTime(ORIGINAL_DWELL_MS))

    h.media.set('a', { url: 'blob:a' })
    await act(async () => finish('blob:a'))
    expect(layers()).toEqual(['blob:a-thumb 1', 'blob:a 0'])

    await decoded('blob:a')
    act(() => vi.advanceTimersByTime(FADE_MS + 50))
    expect(layers()).toEqual(['blob:a 1'])
  })

  it('is used straight away for a slide whose original is already in memory', async () => {
    land('a', { url: 'blob:a' })
    land('a-thumb', { url: 'blob:a-thumb' })
    render(<CrossfadeImage src="a" thumbSrc="a-thumb" />)
    expect(layers()).toEqual(['blob:a 0'])
  })
})

describe('memory', () => {
  it('pins each decrypted photo for as long as a layer shows it', async () => {
    const releases = new Map()
    h.retain = vi.fn((u) => {
      const release = vi.fn()
      releases.set(u, release)
      return release
    })
    const { rerender } = await showA()
    expect(h.retain).toHaveBeenCalledWith('a-thumb')

    land('b-thumb', { url: 'blob:b-thumb' })
    rerender(<CrossfadeImage src="b" thumbSrc="b-thumb" />)
    await decoded('blob:b-thumb')
    // Still fading out underneath b: must stay pinned.
    expect(releases.get('a-thumb')).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(FADE_MS + 50))
    expect(releases.get('a-thumb')).toHaveBeenCalled()
  })
})
