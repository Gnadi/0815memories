import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Pause, Play, Sparkles, Volume2, VolumeX, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import useMediaQuery from '../../hooks/useMediaQuery'
import { prefetchDecryptedMedia } from '../media/useDecryptedMedia'
import { AWARDS, slideUrls } from '../../utils/bestOf'
import {
  getAudioContext,
  musicWantedOnDevice,
  rememberMusic,
  resumeAudio,
  suspendAudio,
  unlockAudio,
} from '../../utils/audioContext'
import { barMs, createSoundtrack, trackForMonth } from '../../utils/bestOfMusic'
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
import { CollageSlide } from './BestOfCollage'
import './bestOf.css'

const SLIDES = {
  intro: IntroSlide,
  count: CountSlide,
  themes: ThemesSlide,
  photo: PhotoSlide,
  collage: CollageSlide,
  video: VideoSlide,
  awardIntro: AwardIntroSlide,
  award: AwardSlide,
  dontForget: DontForgetSlide,
  outro: OutroSlide,
}

// Slides drawn on white, which want the controls in dark.
const LIGHT_SLIDES = new Set(['count', 'themes', 'outro'])

// How long each kind stays up, in beats of the month's track, so the story
// keeps the music's pace — though not its beat: a slide's clock starts once its
// photo is in, whenever that is. The ones with something to read, or several
// photos to arrive, get longer; a clip plays out instead, up to MAX_CLIP_S.
const SLIDE_BEATS = {
  intro: 8,
  count: 6,
  themes: 8,
  photo: 6,
  collage: 12,
  awardIntro: 4,
  award: 8,
  dontForget: 4,
  outro: 12,
}

// A film strip has to travel for its last frame to come into view, which
// takes about seven seconds (bestOf.css), whatever the tempo. With less motion
// asked for, it stands still as another collage does, and takes their time.
const STRIP_BEATS = 14

function beatsOf(slide, still) {
  if (slide.kind === 'collage' && slide.layout === 'strip' && !still) return STRIP_BEATS
  return SLIDE_BEATS[slide.kind] ?? CLIP_FALLBACK_BEATS
}

// A best-of is a glimpse of the month, not the clip itself: the rest of a long
// one is in its moment.
const MAX_CLIP_S = 12

// A clip that cannot be played gets the time of a photo.
const CLIP_FALLBACK_BEATS = SLIDE_BEATS.photo

// The clock waits for a slide's photo — but not for ever: one that cannot be
// loaded must not stop the story.
const READY_TIMEOUT_MS = 3000

// One slide fades into the next over this long; the one being left stays
// mounted beneath until then. Keep in step with .bestof-enter in bestOf.css.
const CROSSFADE_MS = 450

// How the music winds down: quickly when the story is closed, slowly when it
// has reached its end card and is just sitting there.
const CLOSE_FADE_MS = 300
const END_FADE_MS = 2500

// A press longer than this is holding the story, not tapping through it.
const HOLD_MS = 220
const SWIPE_PX = 50
const SWIPE_DOWN_PX = 90

// Presses on the controls are theirs, not the stage's.
const own = { onPointerDown: (e) => e.stopPropagation(), onPointerUp: (e) => e.stopPropagation() }

const noop = () => {}

/**
 * A best-of, played like a story: tap the right of the screen for the next
 * slide, the left for the one before, hold to pause, swipe down to close.
 * Built after Google Photos' highlight videos, but out of the slides
 * utils/bestOf.js chose — photos, collages, clips and award cards, not one
 * rendered video — so it plays the family's own encrypted media, decrypted on
 * the way, to music the browser plays itself (utils/bestOfMusic.js).
 */
export default function BestOfViewer({ bestOf, onClose, onRemake }) {
  const { t, i18n } = useTranslation('bestOf')
  const { encryptionKey } = useAuth()

  // A slide of a kind, or an award, this version does not know — a best-of
  // saved by a newer one — is left out rather than shown blank.
  const slides = useMemo(
    () => (bestOf?.slides || []).filter((s) => SLIDES[s.kind] && (!s.award || AWARDS.includes(s.award))),
    [bestOf],
  )
  const labels = useMemo(() => bestOfLabels(bestOf.month, i18n.language, t), [bestOf.month, i18n.language, t])
  const track = useMemo(() => trackForMonth(bestOf.month), [bestOf.month])
  const beatMs = barMs(track) / 4
  const still = useMediaQuery('(prefers-reduced-motion: reduce)')

  const [index, setIndex] = useState(0)
  const [run, setRun] = useState(0)
  const [userPaused, setUserPaused] = useState(false)
  const [holding, setHolding] = useState(false)
  const [ready, setReady] = useState(false)
  const [clipShare, setClipShare] = useState(0)
  const [finished, setFinished] = useState(false)
  const [clipFailed, setClipFailed] = useState(false)
  const [leaving, setLeaving] = useState(null) // { visit, index } of the slide fading out
  // Hidden — another tab, another app, a locked phone — the story holds.
  const [away, setAway] = useState(false)

  const videoRef = useRef(null)
  const pointer = useRef(null)
  const holdTimer = useRef(null)
  const holdingRef = useRef(false)
  const soundtrack = useRef(null)

  const slide = slides[index]
  const isLast = index === slides.length - 1
  const isVideo = slide?.kind === 'video'
  const light = LIGHT_SLIDES.has(slide?.kind)
  const paused = userPaused || holding || away

  // A new slide starts its clock from nothing, in the render that shows it —
  // as an effect, the old slide's full bar would flash for a frame first. The
  // slide being left is kept for the crossfade.
  //
  // Each showing of a slide is a visit of its own, and the visit is what keys
  // it: going back to a slide shows it afresh — its photo reported ready
  // again, its motion from the start, its clock allowed to run out again —
  // even one still fading out from a moment ago.
  const slideKey = `${run}:${index}`
  const [renderedKey, setRenderedKey] = useState(slideKey)
  const [renderedIndex, setRenderedIndex] = useState(index)
  const [visit, setVisit] = useState(0)
  if (renderedKey !== slideKey) {
    setLeaving({ visit, index: renderedIndex })
    setVisit(visit + 1)
    setRenderedKey(slideKey)
    setRenderedIndex(index)
    setReady(false)
    setClipShare(0)
    setFinished(false)
    setClipFailed(false)
  }

  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(() => setLeaving(null), CROSSFADE_MS + 50)
    return () => clearTimeout(timer)
  }, [leaving])

  const running = ready && !paused && !finished
  // Photos and cards run on a clock; a clip on its own playback.
  const timed = !isVideo || clipFailed

  // ── Music ───────────────────────────────────────────────────────────────
  // Started only where the browser allows sound: opened from the moments row,
  // the tap on its circle unlocked it (utils/audioContext.js); opened from a
  // notification, the first tap on the story or on the music button does.
  // `musicWanted` is the device's choice, `musicOn` whether it is playing.
  const [musicWanted, setMusicWanted] = useState(musicWantedOnDevice)
  const [musicOn, setMusicOn] = useState(() => musicWanted && !!getAudioContext())
  const musicAtStart = useRef(musicOn)

  const play = useCallback(() => {
    if (soundtrack.current) return true
    // A context put to sleep when the music last stopped, or by a pause, is
    // woken: the page has had its gesture by then.
    const context = resumeAudio()
    if (!context) return false
    soundtrack.current = createSoundtrack(context, track)
    soundtrack.current.start()
    return true
  }, [track])

  // The context sleeps once the fade is over, unless play() wakes it first.
  const silence = useCallback((fadeMs) => {
    soundtrack.current?.stop({ fadeMs })
    soundtrack.current = null
    suspendAudio(fadeMs + 100)
  }, [])

  useEffect(() => {
    if (musicAtStart.current) play()
    return () => silence(CLOSE_FADE_MS)
  }, [play, silence])

  useEffect(() => {
    if (paused) soundtrack.current?.pause()
    else soundtrack.current?.resume()
  }, [paused])

  // In a gesture handler, where the browser lets sound begin. Not on the end
  // card, where the music has just wound down on purpose, and not while the
  // story is held, which holds the music too.
  const tapForMusic = () => {
    if (!musicWanted || finished || paused) return
    if (musicOn) {
      // A context the browser did not let start the first time, or stopped
      // when the app went to the background, gets another try with this tap.
      if (getAudioContext()?.state !== 'running') unlockAudio()
      return
    }
    unlockAudio()
    if (play()) setMusicOn(true)
  }

  // Its click must not reach the stage's, which would start again what this
  // has just stopped.
  const toggleMusic = (e) => {
    e.stopPropagation()
    if (musicOn) {
      silence(CLOSE_FADE_MS)
      setMusicOn(false)
    } else {
      unlockAudio()
      if (play()) {
        setMusicOn(true)
        // Turned on while the story is held: it starts held too.
        if (paused) soundtrack.current?.pause()
      }
    }
    rememberMusic(!musicOn)
    setMusicWanted(!musicOn)
  }

  // ── Moving through it ───────────────────────────────────────────────────
  // A step plays on from the slide it reaches, as a story does: held there,
  // the slide would stand at the first frame of its entrance — tiles and
  // caption not yet in — until someone found the play button.
  const next = useCallback(() => {
    if (isLast) onClose()
    else {
      setUserPaused(false)
      setIndex((i) => Math.min(slides.length - 1, i + 1))
    }
  }, [isLast, onClose, slides.length])
  const prev = useCallback(() => {
    setUserPaused(false)
    setIndex((i) => Math.max(0, i - 1))
  }, [])
  const markReady = useCallback(() => setReady(true), [])
  const markClipFailed = useCallback(() => {
    setClipFailed(true)
    setReady(true)
  }, [])

  // The clock has run out: the next slide, or — on the last — stay, and let
  // the music wind down slowly. Once per slide: a clip says it is over twice,
  // its last timeupdate reaching the end and then `ended`, and the second
  // would skip the slide after it.
  const ranOut = useRef(null)
  const timeUp = useCallback(() => {
    if (ranOut.current === visit) return
    ranOut.current = visit
    if (isLast) {
      setFinished(true)
      silence(END_FADE_MS)
      setMusicOn(false)
    } else {
      setIndex((i) => i + 1)
    }
  }, [isLast, visit, silence])

  // "Watch again" is a click, so the music may start over with it.
  const restart = useCallback(() => {
    silence(CLOSE_FADE_MS)
    let on = false
    if (musicWanted) {
      unlockAudio()
      on = play()
    }
    setMusicOn(on)
    setRun((r) => r + 1)
    setIndex(0)
    setUserPaused(false)
  }, [musicWanted, play, silence])

  useEffect(() => {
    if (ready) return
    const timer = setTimeout(() => setReady(true), READY_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [ready, visit])

  useEffect(() => {
    const onVisibility = () => setAway(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // The clip follows the story's pause. It stays muted: the music is the
  // story's sound, and a clip's own would talk over it.
  useEffect(() => {
    const video = videoRef.current
    if (!isVideo || !video) return
    if (paused) video.pause()
    // Older browsers return nothing from play(); newer ones reject a play the
    // autoplay policy refuses, which the muted clip should never hit.
    else video.play()?.catch?.(() => {})
  }, [isVideo, paused, visit])

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
  // listener is registered once. A key is a gesture too, and may start the music.
  const keys = useRef({})
  useEffect(() => {
    keys.current = { next, prev, onClose, tapForMusic }
  })
  useEffect(() => {
    const onKey = (e) => {
      keys.current.tapForMusic()
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

  const ink = light ? 'text-bark' : 'text-white'
  const roundButton = light
    ? 'bg-bark/10 hover:bg-bark/20 text-bark'
    : 'bg-black/30 hover:bg-black/60 text-white'

  // The same element, under the same key, as it was while current — so the
  // slide being left keeps its state and motion while it fades.
  const renderSlide = (shown, key, current) => {
    const Slide = SLIDES[shown.kind]
    return (
      <div
        key={key}
        className={current ? `absolute inset-0 ${leaving ? 'bestof-enter' : ''}` : 'absolute inset-0 pointer-events-none'}
        data-testid={current ? `bestof-slide-${shown.kind}` : undefined}
        aria-hidden={current ? undefined : 'true'}
      >
        <Slide
          slide={shown}
          labels={labels}
          onReady={current ? markReady : noop}
          {...(shown.kind === 'video'
            ? {
              muted: true,
              videoRef: current ? videoRef : undefined,
              onProgress: current ? onClipProgress : noop,
              onEnded: current ? timeUp : noop,
              onFailed: current ? markClipFailed : noop,
            }
            : null)}
          {...(shown.kind === 'outro' ? { onRestart: restart, onRemake } : null)}
        />
      </div>
    )
  }
  const leavingSlide = leaving && slides[leaving.index]

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
        onClick={tapForMusic}
        onContextMenu={(e) => e.preventDefault()}
      >
        {leavingSlide && renderSlide(leavingSlide, `visit-${leaving.visit}`, false)}
        {renderSlide(slide, `visit-${visit}`, true)}

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
                      key={visit}
                      data-testid="bestof-fill"
                      className={`bestof-fill block h-full w-full origin-left ${fill}`}
                      style={{
                        animation: `bestof-fill ${Math.round(beatsOf(slide, still) * beatMs)}ms linear forwards`,
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
            <div className="shrink-0 flex gap-2">
              <button
                type="button"
                {...own}
                onClick={toggleMusic}
                className={`pointer-events-auto w-10 h-10 rounded-full flex items-center justify-center ${roundButton}`}
                aria-label={musicOn ? t('controls.musicOff') : t('controls.musicOn')}
                aria-pressed={musicOn}
              >
                {musicOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button
                type="button"
                {...own}
                onClick={() => setUserPaused((p) => !p)}
                className={`pointer-events-auto w-10 h-10 rounded-full flex items-center justify-center ${roundButton}`}
                aria-label={userPaused ? t('controls.play') : t('controls.pause')}
                aria-pressed={userPaused}
              >
                {userPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
              </button>
            </div>
          </div>
        </div>
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
