// The layer stack behind components/media/CrossfadeImage.jsx, kept apart from
// the component so it can be reasoned about — and tested — without a DOM.

// Quality of what a layer shows, so a better copy of the same photo can take
// over and the story can tell a real photo from its blur-up.
export const TINY = 0
export const THUMB = 1
export const ORIGINAL = 2

let layerSeq = 0

/**
 * The layer stack after the slide's inputs change: what `src` is, the best copy
 * of it ready right now (`best`, or null), and whether loading it failed
 * (`error`).
 *
 * With no `src` the stack only loses what never made it on screen; what is up
 * stays up, for whatever covers it to fade in over. Clearing it is the
 * component's call, once that has happened.
 *
 * Free of side effects apart from minting ids, so it can run inside a state
 * updater. Returns the same array when nothing changes, so React can bail out.
 */
export function nextLayers(layers, { src, error, best }) {
  // A layer that never got to fade in is overtaken: it would only flash, and
  // one from a slide already left would put that photo under this slide's name.
  const shown = layers.filter((l) => l.ready)
  const unchanged = shown.length === layers.length

  if (!src) return unchanged ? layers : shown
  if (!best) {
    // Failed with nothing to show for it: the previous slide must not stand in
    // for this one indefinitely.
    if (error) return layers.length ? [] : layers
    return unchanged ? layers : shown
  }

  const pending = layers[layers.length - 1]
  if (pending && !pending.ready && pending.source === best.source && pending.slide === src) {
    // Already on its way in; starting it again would only restart the decode.
    return layers.length === shown.length + 1 ? layers : [...shown, pending]
  }
  const top = shown[shown.length - 1]
  if (top && top.source === best.source) {
    // Already up — a tap forward and straight back again.
    if (top.slide === src) return unchanged ? layers : shown
    return [...shown.slice(0, -1), { ...top, slide: src }]
  }
  layerSeq += 1
  return [...shown, { id: layerSeq, ...best, slide: src, ready: false }]
}
