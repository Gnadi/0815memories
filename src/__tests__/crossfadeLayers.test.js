/* The story viewer went black between photos: one <img> had its src swapped,
   and the browser drops the old picture before it has decoded the new one, so
   the dark background showed through for a frame or two on every switch.

   CrossfadeImage replaces the swap with a stack of layers, and nextLayers is the
   rule for that stack. Its invariant: nothing that is on screen goes before its
   replacement is ready, and nothing that never made it on screen is shown late. */
import { describe, it, expect } from 'vitest'
import { nextLayers, TINY, THUMB, ORIGINAL } from '../components/media/crossfadeLayers'

const best = (source, quality = THUMB) => ({ source, url: `blob:${source}`, quality })
const ready = (layers) => layers.map((l) => ({ ...l, ready: true }))
const summary = (layers) => layers.map((l) => `${l.slide}:${l.source}${l.ready ? '' : ' (decoding)'}`)

describe('nextLayers', () => {
  it('starts a slide as one layer that is not shown until it has decoded', () => {
    const layers = nextLayers([], { src: 'a', best: best('a-thumb') })
    expect(summary(layers)).toEqual(['a:a-thumb (decoding)'])
    expect(layers[0].quality).toBe(THUMB)
  })

  it('keeps the previous photo underneath while the next one decodes', () => {
    const shown = ready(nextLayers([], { src: 'a', best: best('a-thumb') }))
    const layers = nextLayers(shown, { src: 'b', best: best('b-thumb') })
    expect(summary(layers)).toEqual(['a:a-thumb', 'b:b-thumb (decoding)'])
  })

  it('drops a photo that never made it on screen once the slide has moved on', () => {
    // A tap to b, then straight on to c before b had decoded: b must not fade
    // in later under c's caption.
    let layers = ready(nextLayers([], { src: 'a', best: best('a-thumb') }))
    layers = nextLayers(layers, { src: 'b', best: best('b-thumb') })
    layers = nextLayers(layers, { src: 'c', best: best('c-thumb') })
    expect(summary(layers)).toEqual(['a:a-thumb', 'c:c-thumb (decoding)'])
  })

  it('holds the previous photo when the new slide has nothing ready yet', () => {
    let layers = ready(nextLayers([], { src: 'a', best: best('a-thumb') }))
    layers = nextLayers(layers, { src: 'b', best: best('b-thumb') })
    // …and on to c, which has no blur-up and no thumbnail in memory.
    layers = nextLayers(layers, { src: 'c', best: null })
    expect(summary(layers)).toEqual(['a:a-thumb'])
  })

  it('lets a better copy of the same slide take over, above the one showing', () => {
    let layers = ready(nextLayers([], { src: 'a', best: best('data:tiny', TINY) }))
    layers = nextLayers(layers, { src: 'a', best: best('a-thumb') })
    layers = ready(layers)
    layers = nextLayers(layers, { src: 'a', best: best('a', ORIGINAL) })
    expect(summary(layers)).toEqual(['a:data:tiny', 'a:a-thumb', 'a:a (decoding)'])
  })

  it('does not restart a decode that is already under way', () => {
    const layers = nextLayers([], { src: 'a', best: best('a-thumb') })
    expect(nextLayers(layers, { src: 'a', best: best('a-thumb') })).toBe(layers)
  })

  it('returns the same stack when nothing changes, so React can skip the render', () => {
    const layers = ready(nextLayers([], { src: 'a', best: best('a-thumb') }))
    expect(nextLayers(layers, { src: 'a', best: best('a-thumb') })).toBe(layers)
    expect(nextLayers(layers, { src: 'a', best: null })).toBe(layers)
  })

  it('reuses what is already up when a tap forward is followed by a tap back', () => {
    let layers = ready(nextLayers([], { src: 'a', best: best('a-thumb') }))
    layers = nextLayers(layers, { src: 'b', best: best('b-thumb') })
    layers = nextLayers(layers, { src: 'a', best: best('a-thumb') })
    expect(summary(layers)).toEqual(['a:a-thumb'])
  })

  it('clears a failed slide rather than leaving the previous photo in its place', () => {
    const layers = ready(nextLayers([], { src: 'a', best: best('a-thumb') }))
    expect(nextLayers(layers, { src: 'b', best: null, error: true })).toEqual([])
  })

  it('keeps what is up when there is nothing to show — a clip fades in over it', () => {
    let layers = ready(nextLayers([], { src: 'a', best: best('a-thumb') }))
    layers = nextLayers(layers, { src: 'b', best: best('b-thumb') })
    expect(summary(nextLayers(layers, { src: '' }))).toEqual(['a:a-thumb'])
  })
})
