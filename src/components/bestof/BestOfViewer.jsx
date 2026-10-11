import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Pause, Play, Sparkles, Volume2, VolumeX, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { prefetchDecryptedMedia } from '../media/useDecryptedMedia'
import { slideUrls } from '../../utils/bestOf'
import { bestOfLabels } from './bestOfLabels'
import {
  AwardIntroSlide,
  AwardSlide,
  CountSlide,
  DontForgetSlide,
  IntroSlide,
  OutroSlide,
  PhotoSlide,
  ThemesSlide,
  VideoSlide,
} from './BestOfSlides'
import './bestOf.css'

const SLIDES = {
  intro: IntroSlide,
  count: CountSlide,
  themes: ThemesSlide,
  photo: PhotoSlide,
  video: VideoSlide,
  awardIntro: AwardIntroSlide,
  award: AwardSlide,
  dontForget: DontForgetSlide,
  outro: OutroSlide,
}

// Slides drawn on white, which want the controls in dark.
const LIGHT_SLIDES = new Set(['count', 'themes', 'outro'])

// How long each kind stays up. The ones with something to read get longer; a
// clip plays out instead, up to MAX_CLIP_S.
const SLIDE_MS = {
  intro: 4500,
  count: 4200,
  themes: 5200,
  photo: 4000,
  awardIntro: 3000,
  award: 5200,
  dontForget: 2800,
  outro: 7000,
}

// A best-of is a glimpse of the month, not the clip itself: the rest of a long
// one is in its moment.
const MAX_CLIP_S = 12

// A clip that cannot be played gets the time of a photo.
const CLIP_FALLBACK_MS = 4000

// The clock waits for a slide's photo — but not for ever: one that cannot be
// loaded must not stop the story.
const READY_TIMEOUT_MS = 3000

// A press longer than this is holding the story, not tapping through it.
const HOLD_MS = 220
const SWIPE_PX = 50
const SWIPE_DOWN_PX = 90

// Presses on the controls are theirs, not the stage's.
const own = { onPointerDown: (e) => e.stopPropagation(), onPointerUp: (e) => e.stopPropagation() }

/**
 * A best-of, played like a story: tap the right of the screen for the next
 * slide, the left for the one before, hold to pause, swipe down to close.
 * Built after Google Photos' highlight videos, but out of the slides
 * utils/bestOf.js chose — photos, clips and award cards, not one rendered
 * video — so it plays the family's own encrypted media, decrypted on the way.
 */
export default function BestOfViewer({ bestOf, onClose, onRemake }) {
  const { t, i18n } = useTranslation('bestOf')
  const { encryptionKey } = useAuth()

  // A slide of a kind this version does not know — a best-of saved by a
  // newer one — is left out rather than shown blank.
  const slides = useMemo(() => (bestOf?.slides || []).filter((s) => SLIDES[s.kind]), [bestOf])
  const labels = useMemo(() => bestOfLabels(bestOf.month, i18n.language, t), [bestOf.month, i18n.language, t])

  const [index, setIndex] = useState(0)
  const [run, setRun] = useState(0)
  const [userPaused, setUserPaused] = useState(false)
  const [holding, setHolding] = useState(false)
  const [ready, setReady] = useState(false)
  const [clipShare, setClipShare] = useState(0)
  const [finished, setFinished] = useState(false)
  const [muted, setMuted] = useState(true)
  const [clipFailed, setClipFailed] = useState(false)

  const videoRef = useRef(null)
  const pointer = useRef(null)
  const holdTimer = useRef(null)
  const holdingRef = useRef(false)

  const slide = slides[index]
  const isLast = index === slides.length - 1
  const isVideo = slide?.kind === 'video'
  const light = LIGHT_SLIDES.has(slide?.kind)
  const paused = userPaused || holding

  // A new slide starts its clock from nothing, in the render that shows it —
  // as an effect, the old slide's full bar would flash for a frame first.
  const slideKey = `${run}:${index}`
  const [renderedKey, setRenderedKey] = useState(slideKey)
  if (renderedKey !== slideKey) {
    setRenderedKey(slideKey)
    setReady(false)
    setClipShare(0)
    setFinished(false)
    setClipFailed(false)
  }

  const running = ready && !paused && !finished
  // Photos and cards run on a clock; a clip on its own playback.
  const timed = !isVideo || clipFailed

  const next = useCallback(() => {
    if (isLast) onClose()
    else setIndex((i) => Math.min(slides.length - 1, i + 1))
  }, [isLast, onClose, slides.length])
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])
  const markReady = useCallback(() => setReady(true), [])
  const markClipFailed = useCallback(() => {
    setClipFailed(true)
    setReady(true)
  }, [])

  // The clock has run out: the next slide, or — on the last — stay. Once per
  // slide: a clip says it is over twice, its last timeupdate reaching the end
  // and then `ended`, and the second would skip the slide after it.
  const ranOut = useRef(null)
  const timeUp = useCallback(() => {
    if (ranOut.current === slideKey) return
    ranOut.current = slideKey
    if (isLast) setFinished(true)
    else setIndex((i) => i + 1)
  }, [isLast, slideKey])

  const restart = useCallback(() => {
    setRun((r) => r + 1)
    setIndex(0)
    setUserPaused(false)
  }, [])

  useEffect(() => {
    if (ready) return
    const timer = setTimeout(() => setReady(true), READY_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [ready, slideKey])

  // The clip follows the story's pause, and the sound switch.
  useEffect(() => {
    const video = videoRef.current
    if (!isVideo || !video) return
    if (paused) video.pause()
    // Older browsers return nothing from play(); newer ones reject a play the
    // autoplay policy refuses, which the muted clip should never hit.
    else video.play()?.catch?.(() => {})
  }, [isVideo, paused, slideKey])
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted
  }, [muted, slideKey])

  const onClipProgress = useCallback((currentTime, duration) => {
    const share = currentTime / Math.min(duration, MAX_CLIP_S)
    if (share >= 1) timeUp()
    else setClipShare(share)
  }, [timeUp])

  // Warm what the next taps reach.
  useEffect(() => {
    if (!encryptionKey) return
    for (const upcoming of [slides[index + 1], slides[index + 2]]) {
      for (const { url, video } of slideUrls(upcoming)) {
        prefetchDecryptedMedia(url, encryptionKey, video ? 'video/*' : 'image/*')
      }
    }
  }, [index, encryptionKey, slides])

  // Keyboard: arrows step, space pauses, escape closes. Through refs, so the
  // listener is registered once.
  const keys = useRef({})
  useEffect(() => {
    keys.current = { next, prev, onClose }
  })
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') keys.current.next()
      else if (e.key === 'ArrowLeft') keys.current.prev()
      else if (e.key === 'Escape') keys.current.onClose()
      else if (e.key === ' ') {
        e.preventDefault()
        setUserPaused((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  // ── Gestures ────────────────────────────────────────────────────────────
  const onPointerDown = (e) => {
    pointer.current = { x: e.clientX, y: e.clientY, at: Date.now() }
    clearTimeout(holdTimer.current)
    holdTimer.current = setTimeout(() => {
      holdingRef.current = true
      setHolding(true)
    }, HOLD_MS)
  }
  const onPointerUp = (e) => {
    clearTimeout(holdTimer.current)
    const start = pointer.current
    const held = holdingRef.current
    pointer.current = null
    holdingRef.current = false
    setHolding(false)
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (dy > SWIPE_DOWN_PX && Math.abs(dy) > Math.abs(dx)) onClose()
    else if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)()
    else if (!held) {
      const rect = e.currentTarget.getBoundingClientRect()
      if (e.clientX - rect.left < rect.width / 3) prev()
      else next()
    }
  }
  const onPointerCancel = () => {
    clearTimeout(holdTimer.current)
    pointer.current = null
    holdingRef.current = false
    setHolding(false)
  }

  if (!slide) return null

  const Slide = SLIDES[slide.kind]
  const ink = light ? 'text-bark' : 'text-white'
  const roundButton = light
    ? 'bg-bark/10 hover:bg-bark/20 text-bark'
    : 'bg-black/30 hover:bg-black/60 text-white'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={labels.title}
    >
      <button
        type="button"
        onClick={prev}
        disabled={index === 0}
        className="hidden sm:flex mr-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center disabled:opacity-30"
        aria-label={t('controls.previous')}
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <div
        className={`relative w-full h-full sm:w-auto sm:h-[min(92vh,52rem)] sm:aspect-[9/16] sm:rounded-3xl overflow-hidden select-none touch-none bg-[#141a2e] ${paused ? 'bestof-paused' : ''}`}
        data-testid="bestof-stage"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div key={slideKey} className="absolute inset-0" data-testid={`bestof-slide-${slide.kind}`}>
          <Slide
            slide={slide}
            labels={labels}
            onReady={markReady}
            {...(isVideo ? { muted, videoRef, onProgress: onClipProgress, onEnded: timeUp, onFailed: markClipFailed } : null)}
            {...(slide.kind === 'outro' ? { onRestart: restart, onRemake } : null)}
          />
        </div>

        {/* Controls */}
        <div
          className={`absolute inset-x-0 top-0 z-20 px-3 pb-8 pt-[max(0.75rem,env(safe-area-inset-top))] ${light ? '' : 'bg-gradient-to-b from-black/60 to-transparent'} pointer-events-none`}
        >
          <div className="flex items-center gap-[3px] h-7" aria-hidden="true">
            {slides.map((_, i) => {
              const fill = light ? 'bg-bark' : 'bg-white'
              const current = i === index
              return [
                // While paused, the current segment folds away for the pill
                // rather than unmounting: its fill is the slide's clock, and
                // a remount would start it over.
                <span
                  key={i}
                  className={`h-[3px] rounded-full overflow-hidden ${light ? 'bg-bark/20' : 'bg-white/35'} ${current && paused ? 'w-0 flex-none opacity-0' : 'flex-1'}`}
                >
                  {i < index && <span className={`block h-full w-full ${fill}`} />}
                  {current && (timed ? (
                    <span
                      key={slideKey}
                      data-testid="bestof-fill"
                      className={`bestof-fill block h-full w-full origin-left ${fill}`}
                      style={{
                        animation: `bestof-fill ${SLIDE_MS[slide.kind] ?? CLIP_FALLBACK_MS}ms linear forwards`,
                        animationPlayState: running ? 'running' : 'paused',
                      }}
                      onAnimationEnd={timeUp}
                    />
                  ) : (
                    <span className={`block h-full w-full origin-left ${fill}`} style={{ transform: `scaleX(${clipShare})` }} />
                  ))}
                </span>,
                current && paused && (
                  <span
                    key="paused"
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-warm-white text-bark px-3 py-1 text-xs font-semibold shadow"
                  >
                    <Pause className="w-3 h-3 fill-current" />
                    {t('controls.paused')}
                  </span>
                ),
              ]
            })}
          </div>

          <div className="mt-2 flex items-start justify-between gap-3">
            <button
              type="button"
              {...own}
              onClick={onClose}
              className={`pointer-events-auto shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${roundButton}`}
              aria-label={t('controls.close')}
            >
              <X className="w-5 h-5" />
            </button>
            <div className={`min-w-0 text-center ${ink}`}>
              <p className="text-base font-semibold leading-tight truncate drop-shadow">{labels.title}</p>
              <p className={`mt-0.5 inline-flex items-center gap-1 text-xs ${light ? 'text-bark-light' : 'text-white/85'}`}>
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                {t('subtitle')}
              </p>
            </div>
            <button
              type="button"
              {...own}
              onClick={() => setUserPaused((p) => !p)}
              className={`pointer-events-auto shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${roundButton}`}
              aria-label={userPaused ? t('controls.play') : t('controls.pause')}
              aria-pressed={userPaused}
            >
              {userPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
            </button>
          </div>
        </div>

        {isVideo && (
          <button
            type="button"
            {...own}
            onClick={() => setMuted((m) => !m)}
            className="absolute right-4 bottom-10 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center"
            aria-label={muted ? t('controls.soundOn') : t('controls.soundOff')}
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={next}
        className="hidden sm:flex ml-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center"
        aria-label={t('controls.next')}
      >
        <ChevronRight className="w-6 h-6" />
      </button>
    </div>
  )
}
