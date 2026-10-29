import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import useDecryptedMedia, {
  peekDecryptedMedia,
  prefetchDecryptedMedia,
  retainDecryptedMedia,
} from './useDecryptedMedia'
import { PLACEHOLDER_CLASSES } from './placeholder'
import { ORIGINAL, THUMB, TINY, nextLayers } from './crossfadeLayers'
import { displayCopyKey, fitForDisplay, frameOf } from './displayCopy'

// How long one image takes to fade in over the last. Short enough that tapping
// through a story still feels immediate, long enough that a new photo arrives
// rather than flashes. Keep in step with `duration-200` on the layers below.
export const FADE_MS = 200

// How long a slide has to stay on screen before its full original is fetched.
// Tapping through a story would otherwise start a multi-megabyte download for
// every slide passed, and the thumbnails of the slides ahead would queue behind
// them in the prefetch lane.
export const ORIGINAL_DWELL_MS = 300

/**
 * One image in the stack. It stays transparent until the browser has decoded
 * it, and only then fades in. That order is the whole point: an <img> whose src
 * changes drops its old picture before the new one is decoded, and on a dark
 * story background that gap is a black frame on every switch.
 */
const Layer = memo(function Layer({ id, source, url, ready, blurred, alt, fit, onDecoded }) {
  const imgRef = useRef(null)

  // Hold the decrypted blob for as long as this layer shows it. The hook that
  // decrypted it has usually moved on to the next slide by the time this layer
  // fades out, and an evicted object URL blanks the element showing it.
  useEffect(() => retainDecryptedMedia(source), [source])

  useEffect(() => {
    const img = imgRef.current
    if (!img) return
    let cancelled = false
    const done = () => {
      if (!cancelled) onDecoded(id)
    }
    // A rejection means this image will never decode (a format this browser
    // cannot read). Showing the failure is better than holding the previous
    // photo on screen forever, so it counts as done too.
    const decoding = typeof img.decode === 'function' ? img.decode() : Promise.resolve()
    decoding.then(done, done)
    return () => {
      cancelled = true
    }
  }, [id, url, onDecoded])

  return (
    <img
      ref={imgRef}
      src={url}
      alt={alt}
      aria-hidden={alt ? undefined : 'true'}
      draggable={false}
      decoding="async"
      className={`absolute inset-0 w-full h-full ${fit} pointer-events-none select-none transition-opacity duration-200 ease-out motion-reduce:transition-none`}
      // scale hides the blur's soft edges, which would otherwise show as a pale
      // border around the frame.
      style={{
        opacity: ready ? 1 : 0,
        ...(blurred ? { filter: 'blur(12px)', transform: 'scale(1.08)' } : null),
      }}
    />
  )
})

/**
 * The picture area of the story viewer: shows `src`, and crossfades every change.
 *
 * Nothing on screen is ever taken away before its replacement is decoded. The
 * previous photo stays up until the next one — this slide's blur-up, its
 * thumbnail or its original, whichever is ready first — can be painted, and then
 * the new one fades in over it. The same holds within a slide, so the blur-up
 * sharpening into the thumbnail and the thumbnail into the original are fades
 * as well, never a gap.
 *
 * `thumbSrc` is what a slide opens on; the original follows once the slide has
 * been looked at for a moment, downscaled to the frame it fills (displayCopy.js).
 * `tinyPreview` is the blur-up shown while neither is ready.
 *
 * `src` empty means there is nothing here to show. With `hold`, whatever is on
 * screen stays up (a video about to cover it has no frame yet); without it, the
 * stage clears, a fade's length later, so what covers it can fade in first.
 *
 * `onSettled(src)` fires once the slide shows a real photo — not just its
 * blur-up — or has failed to load, so the caller can start its clock.
 *
 * `children` sit beneath the layers — a clip being left, paused on its last
 * frame, which the next photo fades in over like any other picture. The stage
 * is its own stacking context, so a child can be lifted above the layers (the
 * clip being played) without reaching anything outside it. `onShown(src)` fires
 * once the slide's first picture has fully faded in, when nothing beneath it
 * can be seen any more.
 */
function CrossfadeImage({
  src = '',
  thumbSrc = '',
  tinyPreview = '',
  hold = false,
  alt = '',
  fit = 'object-cover',
  className = '',
  onSettled,
  onShown,
  children,
}) {
  const { encryptionKey } = useAuth()

  // What this slide can show, best first. The hook fetches the first copy in
  // the foreground lane: the thumbnail, or the original when there is none.
  const first = thumbSrc || src
  const { decryptedUrl: firstUrl, error } = useDecryptedMedia(first, 'image/*')
  // The original, as shown: its display copy — the original downscaled to this
  // frame (see displayCopy.js) — or the original itself where a copy would not
  // help. Read from the cache on every render rather than kept in state: an
  // object URL held here could be evicted and revoked while the story is on
  // another slide, and coming back would paint it blank. The state only exists
  // to re-render when the copy is ready.
  const [, setOriginalLanded] = useState('')
  const originalKey = src ? displayCopyKey(src) : null
  const originalUrl = originalKey ? peekDecryptedMedia(originalKey) : null

  let best = null
  if (!src) best = null
  else if (originalUrl) best = { source: originalKey, url: originalUrl, quality: ORIGINAL }
  else if (firstUrl) best = { source: first, url: firstUrl, quality: thumbSrc ? THUMB : ORIGINAL }
  else if (tinyPreview) best = { source: tinyPreview, url: tinyPreview, quality: TINY }

  // Bottom to top: [{ id, source, url, quality, slide, ready }]. Everything is
  // added on top; a layer that finishes fading in retires everything below it.
  const [layers, setLayers] = useState([])

  const bestSource = best?.source ?? ''
  const bestUrl = best?.url ?? ''
  const bestQuality = best?.quality ?? -1
  useEffect(() => {
    // After commit rather than during render, deliberately. useDecryptedMedia
    // re-resolves a new URL during render, so for one render pass it still
    // returns the previous slide's photo; pushed from there, that pass would
    // stack the old picture under the new slide's name. Once committed, every
    // input here describes the same slide.
    const next = bestUrl ? { source: bestSource, url: bestUrl, quality: bestQuality } : null
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLayers((ls) => nextLayers(ls, { src, error: !!error, best: next }))
  }, [src, bestSource, bestUrl, bestQuality, error])

  // Nothing to show and nothing to hold for: clear — but only once whatever
  // replaces the picture has had time to fade in over it. Clearing at once put
  // a black frame between a photo and a clip that was only starting to appear.
  useEffect(() => {
    if (src || hold) return
    const timer = setTimeout(() => setLayers((ls) => (ls.length ? [] : ls)), FADE_MS + 50)
    return () => clearTimeout(timer)
  }, [src, hold])

  const markDecoded = useCallback((id) => {
    setLayers((ls) => ls.map((l) => (l.id === id && !l.ready ? { ...l, ready: true } : l)))
  }, [])

  // Once the top visible layer has finished fading in, nothing under it can be
  // seen: let those go, and their decoded bitmaps with them.
  let topShown = -1
  for (let i = layers.length - 1; i >= 0; i--) {
    if (layers[i].ready) {
      topShown = i
      break
    }
  }
  const retireBelow = topShown > 0 ? layers[topShown].id : null
  useEffect(() => {
    if (retireBelow === null) return
    const timer = setTimeout(() => {
      setLayers((ls) => {
        const index = ls.findIndex((l) => l.id === retireBelow)
        return index > 0 ? ls.slice(index) : ls
      })
    }, FADE_MS + 50)
    return () => clearTimeout(timer)
  }, [retireBelow])

  const shownForSlide = layers.filter((l) => l.slide === src && l.ready)
  const settled = !!src && (shownForSlide.some((l) => l.quality >= THUMB) || !!error)
  const waiting = hold || (!!src && shownForSlide.length === 0 && !error)

  const onSettledRef = useRef(onSettled)
  const onShownRef = useRef(onShown)
  useEffect(() => {
    onSettledRef.current = onSettled
    onShownRef.current = onShown
  })
  useEffect(() => {
    if (settled) onSettledRef.current?.(src)
  }, [settled, src])

  const firstShown = shownForSlide.length ? shownForSlide[0].id : null
  useEffect(() => {
    if (firstShown === null) return
    const timer = setTimeout(() => onShownRef.current?.(src), FADE_MS + 50)
    return () => clearTimeout(timer)
  }, [firstShown, src])

  // The original, once this slide has been looked at for a moment — through the
  // prefetch lane, so it never holds up a thumbnail someone is waiting for —
  // and then its display copy. A moment without thumbnails already shows the
  // original; it only needs the copy, and does not wait for it.
  const frameRef = useRef(null)
  useEffect(() => {
    if (!src || !encryptionKey || !settled || originalUrl) return
    let cancelled = false
    const timer = setTimeout(async () => {
      const decrypted = await prefetchDecryptedMedia(src, encryptionKey, 'image/*')
      if (cancelled || !decrypted) return
      const key = await fitForDisplay(src, frameOf(frameRef.current))
      if (!cancelled && key) setOriginalLanded(key)
    }, thumbSrc ? ORIGINAL_DWELL_MS : 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [src, thumbSrc, encryptionKey, settled, originalUrl])

  // Only the newest layer of this slide speaks for it; the rest are
  // transitions, and a screen reader should not hear the photo twice.
  let speaking = null
  for (const layer of layers) if (layer.slide === src) speaking = layer

  return (
    <div ref={frameRef} className={`isolate overflow-hidden ${className}`}>
      {children}
      {layers.map((layer) => (
        <Layer
          key={layer.id}
          id={layer.id}
          source={layer.source}
          url={layer.url}
          ready={layer.ready}
          blurred={layer.quality === TINY}
          alt={layer === speaking ? alt : ''}
          fit={fit}
          onDecoded={markDecoded}
        />
      ))}
      {/* The wait state, for a slide with nothing to show yet: the last photo
          dims and the decrypt spinner appears — but only after a delay, so a
          switch that is quick shows neither. */}
      {waiting && (
        <div
          data-testid="crossfade-waiting"
          className={`absolute inset-0 pointer-events-none ${PLACEHOLDER_CLASSES} story-waiting`}
        />
      )}
    </div>
  )
}

export default memo(CrossfadeImage)
