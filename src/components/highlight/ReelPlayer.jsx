import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { ASPECTS, DEFAULT_ASPECT } from '../collage/collageTemplates'
import { buildTimeline, drawReelFrame, playReel, reelSize } from '../../utils/reelRenderer'

/**
 * Plays a highlight reel on a canvas.
 *
 * The parent gets the canvas element through the forwarded ref, because the
 * download path records this very canvas — recording a second, hidden one would
 * let what the user watched and what they downloaded drift apart.
 */
const ReelPlayer = forwardRef(function ReelPlayer(
  { doc, images, renderWidth = 720, disabled = false },
  ref
) {
  const { t } = useTranslation('collage')
  const canvasRef = useRef(null)
  const playerRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)

  useImperativeHandle(ref, () => canvasRef.current, [])

  const timeline = useMemo(
    () => buildTimeline(doc?.shots, { transitionMs: doc?.transitionMs, titleCard: doc?.titleCard }),
    [doc]
  )
  const size = useMemo(() => reelSize(doc?.aspect, renderWidth), [doc?.aspect, renderWidth])
  const ratio = ASPECTS[doc?.aspect || DEFAULT_ASPECT] ?? ASPECTS[DEFAULT_ASPECT]

  // Paint the first frame whenever the reel changes, so the player is never a
  // blank rectangle before the user presses play.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (!playing) drawReelFrame(ctx, doc, images, timeline, position, size)
  }, [doc, images, timeline, size, position, playing])

  useEffect(() => () => playerRef.current?.stop(), [])

  const stop = () => {
    playerRef.current?.stop()
    playerRef.current = null
    setPlaying(false)
  }

  const start = (from = 0) => {
    const canvas = canvasRef.current
    if (!canvas || timeline.durationMs === 0) return
    playerRef.current?.stop()
    setPlaying(true)
    playerRef.current = playReel(canvas, doc, images, timeline, {
      startAt: from,
      onProgress: setPosition,
      onEnded: () => {
        playerRef.current = null
        setPlaying(false)
      },
    })
  }

  const toggle = () => {
    if (playing) { stop(); return }
    start(position >= timeline.durationMs ? 0 : position)
  }

  // m:ss — a reel is seconds long, and "0:08" must not read as eight minutes.
  const clock = (ms) => {
    const total = Math.floor(ms / 1000)
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
  }
  const progress = timeline.durationMs ? Math.min(1, position / timeline.durationMs) : 0

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <div
        className="relative w-full max-w-[min(100%,20rem)] rounded-2xl overflow-hidden bg-bark border border-cream-dark shadow-[0_8px_28px_rgba(45,27,14,0.16)]"
        style={{ aspectRatio: String(ratio) }}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      <div className="w-full max-w-[min(100%,20rem)] flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={disabled || timeline.durationMs === 0}
          aria-label={playing ? t('reel.pause') : t('reel.play')}
          className="w-11 h-11 rounded-full bg-kaydo text-white flex items-center justify-center disabled:opacity-40"
        >
          {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>

        <div className="flex-1 h-1.5 rounded-full bg-cream-dark overflow-hidden">
          <div className="h-full bg-kaydo transition-[width] duration-100" style={{ width: `${progress * 100}%` }} />
        </div>

        <span className="text-[11px] tabular-nums text-bark-muted w-16 text-right">
          {clock(position)} / {clock(timeline.durationMs)}
        </span>

        <button
          type="button"
          onClick={() => { stop(); setPosition(0) }}
          aria-label={t('reel.restart')}
          className="w-9 h-9 rounded-full text-bark-muted hover:bg-cream-dark/60 flex items-center justify-center"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
})

export default ReelPlayer
