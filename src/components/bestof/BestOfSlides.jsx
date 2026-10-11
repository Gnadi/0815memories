import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, RotateCcw, Trophy } from 'lucide-react'
import useDecryptedMedia from '../media/useDecryptedMedia'
import CrossfadeImage from '../media/CrossfadeImage'
import EncryptedVideo from '../media/EncryptedVideo'
import { MOTIONS } from '../../utils/bestOf'

/**
 * The slides of a best-of, one component per kind (utils/bestOf.js makes the
 * list). Each is mounted afresh when it is shown, so its motion starts over,
 * and each says `onReady` once there is something to look at — the viewer's
 * clock waits for that, so a slow photo does not eat its own time on screen.
 */

// A photo inside a collage or behind text. A thumbnail is plenty there, and it
// arrives sooner; the blur-up rides on the best-of itself and shows at once.
export function SlideImage({ media, className = '', style, onReady }) {
  const { decryptedUrl, error } = useDecryptedMedia(media?.thumbUrl || media?.url || '', 'image/*')
  const [loaded, setLoaded] = useState(false)
  const reported = useRef(false)
  const report = () => {
    if (reported.current) return
    reported.current = true
    onReady?.()
  }
  useEffect(() => {
    if (error) report()
  })
  if (!media) return null
  return (
    <>
      {media.tiny && !loaded && (
        <img
          src={media.tiny}
          alt=""
          aria-hidden="true"
          draggable={false}
          className={`absolute inset-0 w-full h-full object-cover ${className}`}
          style={{ ...style, filter: `${style?.filter || ''} blur(12px)`, transform: 'scale(1.08)' }}
        />
      )}
      {decryptedUrl && (
        <img
          src={decryptedUrl}
          alt=""
          draggable={false}
          onLoad={() => {
            setLoaded(true)
            report()
          }}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${className}`}
          style={{ ...style, opacity: loaded ? style?.opacity ?? 1 : 0 }}
        />
      )}
    </>
  )
}

// A photo that fills the slide: the thumbnail first, then the original once it
// has been looked at for a moment — the moments viewer's stage does both.
function FullPhoto({ media, onReady, className = 'bestof-zoom', alt = '' }) {
  return (
    <div className={`absolute inset-0 ${className}`}>
      <CrossfadeImage
        src={media?.url || ''}
        thumbSrc={media?.thumbUrl || ''}
        tinyPreview={media?.tiny || ''}
        alt={alt}
        className="absolute inset-0 w-full h-full bg-[#141a2e]"
        onSettled={onReady}
      />
    </div>
  )
}

export const BottomShade = ({ strength = 'from-black/70' }) => (
  <div className={`absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t ${strength} via-black/20 to-transparent pointer-events-none`} />
)

// ── Opening card: the month's name among its photos ─────────────────────────

// Where the floating photos sit, in percent of the slide, near ones sharp and
// far ones soft — the depth of Google's opening card.
const FLOATING = [
  { left: -8, top: 3, width: 48, height: 32, blur: 0, drift: 'a', delay: 0 },
  { left: 42, top: 16, width: 22, height: 19, blur: 5, drift: 'b', delay: 0.15 },
  { left: 68, top: 31, width: 17, height: 13, blur: 3, drift: 'a', delay: 0.3 },
  { left: -6, top: 48, width: 24, height: 27, blur: 7, drift: 'b', delay: 0.2 },
  { left: 74, top: 56, width: 22, height: 15, blur: 5, drift: 'b', delay: 0.35 },
  { left: 44, top: 77, width: 64, height: 30, blur: 0, drift: 'a', delay: 0.1 },
]

export function IntroSlide({ slide, labels, onReady }) {
  const photos = slide.media || []
  return (
    <div className="absolute inset-0 bg-[#141a2e] overflow-hidden">
      {FLOATING.slice(0, photos.length).map((spot, i) => (
        <div
          key={i}
          className={`absolute rounded-2xl overflow-hidden bestof-drift-${spot.drift}`}
          style={{
            left: `${spot.left}%`,
            top: `${spot.top}%`,
            width: `${spot.width}%`,
            height: `${spot.height}%`,
            animationDelay: `${-spot.delay * 10}s`,
            filter: spot.blur ? `blur(${spot.blur}px)` : undefined,
            opacity: spot.blur ? 0.85 : 1,
          }}
        >
          <SlideImage media={photos[i]} onReady={i === 0 ? onReady : undefined} />
        </div>
      ))}
      <div className="absolute inset-x-0 top-[44%] flex flex-col items-center pointer-events-none">
        <p
          className="bestof-pop font-display text-white uppercase leading-none drop-shadow-lg"
          style={{ fontSize: 'min(28vw, 9rem)' }}
        >
          {labels.monthShort}
        </p>
        <p className="bestof-text mt-2 text-white/80 text-lg font-semibold tracking-[0.3em]" style={{ animationDelay: '0.6s' }}>
          {labels.year}
        </p>
      </div>
    </div>
  )
}

// ── The month in numbers ────────────────────────────────────────────────────

function useCountUp(target, durationMs = 1400) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let frame
    const start = performance.now()
    const step = (now) => {
      const t = Math.min(1, (now - start) / durationMs)
      // Ease out: fast at first, settling on the number.
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs])
  return value
}

export function CountSlide({ slide, onReady }) {
  const { t, i18n } = useTranslation('bestOf')
  const total = (slide.photos || 0) + (slide.videos || 0)
  const shown = useCountUp(total)
  const label = slide.videos > 0 ? t('count.photosAndVideos') : t('count.photos', { count: slide.photos })
  return (
    <div className="absolute inset-0 overflow-hidden bg-cream">
      <div
        className="bestof-rise absolute left-[2%] right-[-8%] top-[30%] bottom-[-6%] rounded-[2rem] overflow-hidden shadow-2xl"
        style={{ '--bestof-tilt': '2deg', '--bestof-tilt-from': '8deg' }}
      >
        <SlideImage media={slide.media} onReady={onReady} />
        <div className="absolute inset-0 bg-black/35" />
      </div>
      <div className="absolute inset-x-0 top-[52%] flex flex-col items-center text-white pointer-events-none">
        <p className="font-black leading-none tabular-nums drop-shadow-lg" style={{ fontSize: 'min(30vw, 9.5rem)' }}>
          {shown.toLocaleString(i18n.language)}
        </p>
        <p className="bestof-text mt-3 text-2xl sm:text-3xl font-bold drop-shadow" style={{ animationDelay: '0.9s' }}>
          {label}
        </p>
      </div>
    </div>
  )
}

// ── What the month was about ────────────────────────────────────────────────

// Below the controls, which have no shade of their own on a light slide.
const THEME_CARDS = [
  { left: -6, top: 16, width: 36, height: 22, tilt: -10, delay: 0 },
  { left: 33, top: 13, width: 40, height: 26, tilt: 3, delay: 0.15 },
  { left: 76, top: 21, width: 34, height: 24, tilt: 9, delay: 0.3 },
]

export function ThemesSlide({ slide, labels, onReady }) {
  const media = slide.media || []
  return (
    <div className="absolute inset-0 overflow-hidden bg-warm-white bg-gradient-to-b to-cream-dark">
      {THEME_CARDS.map((card, i) => media[i] && (
        <div
          key={i}
          className="bestof-drop absolute rounded-3xl overflow-hidden shadow-xl"
          style={{
            left: `${card.left}%`,
            top: `${card.top}%`,
            width: `${card.width}%`,
            height: `${card.height}%`,
            '--bestof-tilt': `${card.tilt}deg`,
            animationDelay: `${card.delay}s`,
          }}
        >
          <SlideImage media={media[i]} onReady={i === 0 ? onReady : undefined} />
        </div>
      ))}
      <div className="absolute inset-x-6 top-[54%] text-center text-bark">
        {slide.themes.map((theme, i) => (
          <p
            key={theme}
            className="bestof-text text-3xl sm:text-4xl font-semibold leading-snug break-words"
            style={{ animationDelay: `${0.3 + i * 0.25}s` }}
          >
            {theme}
          </p>
        ))}
        <p
          className="bestof-text mt-1 text-3xl sm:text-4xl leading-snug"
          style={{ animationDelay: `${0.3 + slide.themes.length * 0.25}s` }}
        >
          {labels.monthYear}
        </p>
      </div>
      {!media.some(Boolean) && <ReadyNow onReady={onReady} />}
    </div>
  )
}

// A slide with no photo of its own is ready as soon as it is shown.
function ReadyNow({ onReady }) {
  useEffect(() => {
    onReady?.()
  }, [onReady])
  return null
}

// ── The month's photos and clips ────────────────────────────────────────────

export function Caption({ caption, meta, children }) {
  if (!caption && !meta && !children) return null
  return (
    <div className="absolute inset-x-0 bottom-0 px-6 pb-10 text-white pointer-events-none">
      {children}
      {caption && <p className="bestof-text text-xl font-semibold leading-snug drop-shadow" style={{ animationDelay: '0.4s' }}>{caption}</p>}
      {meta && <p className="bestof-text mt-1 text-sm text-white/80 drop-shadow" style={{ animationDelay: '0.6s' }}>{meta}</p>}
    </div>
  )
}

// The camera move utils/bestOf.js chose, so that photo after photo does not
// push in the same way. One this version does not know — from a best-of saved
// by a newer one — gets the push in.
const motionOf = (slide) => `bestof-motion-${MOTIONS.includes(slide.motion) ? slide.motion : 'zoomIn'}`

export function PhotoSlide({ slide, labels, onReady }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#141a2e]">
      <FullPhoto media={slide.media} onReady={onReady} className={motionOf(slide)} alt={slide.caption || ''} />
      <BottomShade />
      <Caption caption={slide.caption} meta={labels.meta(slide)} />
    </div>
  )
}

export function VideoSlide({ slide, labels, muted, videoRef, onReady, onProgress, onEnded, onFailed }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <EncryptedVideo
        ref={videoRef}
        src={slide.media?.url}
        autoPlay
        muted={muted}
        playsInline
        controls={false}
        className="absolute inset-0 w-full h-full object-cover"
        onLoadedData={onReady}
        onError={onFailed}
        onTimeUpdate={(e) => {
          const { currentTime, duration } = e.currentTarget
          if (duration > 0) onProgress(currentTime, duration)
        }}
        onEnded={onEnded}
      />
      <BottomShade />
      <Caption caption={slide.caption} meta={labels.meta(slide)} />
    </div>
  )
}

// ── Awards ──────────────────────────────────────────────────────────────────

export function AwardIntroSlide({ slide, onReady }) {
  const { t } = useTranslation('bestOf')
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#141a2e]">
      <SlideImage media={slide.media} onReady={onReady} style={{ filter: 'blur(26px) brightness(0.55)', transform: 'scale(1.2)' }} />
      <div className="absolute inset-0 flex items-center justify-center px-8">
        <p className="bestof-text text-white text-center text-[2rem] sm:text-4xl font-semibold leading-tight drop-shadow-lg">
          {t(`awardIntro.${slide.award}`)}
        </p>
      </div>
    </div>
  )
}

function AwardDetail({ slide, labels }) {
  const { t } = useTranslation('bestOf')
  const big = 'bestof-text text-3xl sm:text-4xl font-bold leading-tight drop-shadow-lg break-words'
  const small = 'bestof-text mt-1 text-sm text-white/85 drop-shadow'
  switch (slide.award) {
    case 'place':
      return (
        <>
          <p className={big} style={{ animationDelay: '0.8s' }}>{slide.place}</p>
          <p className={small} style={{ animationDelay: '1s' }}>{t('award.entries', { count: slide.entries })}</p>
        </>
      )
    case 'busiestDay':
      return (
        <>
          <p className={big} style={{ animationDelay: '0.8s' }}>{labels.longDay(slide.day)}</p>
          <p className={small} style={{ animationDelay: '1s' }}>
            {t(slide.videos ? 'award.dayMedia' : 'award.dayPhotos', { count: slide.count })}
          </p>
        </>
      )
    case 'story':
      return slide.caption ? <p className={big} style={{ animationDelay: '0.8s' }}>{slide.caption}</p> : null
    default:
      return (
        <>
          {slide.caption && <p className="bestof-text text-lg font-semibold drop-shadow" style={{ animationDelay: '0.8s' }}>{slide.caption}</p>}
          {labels.meta(slide) && <p className={small} style={{ animationDelay: '1s' }}>{labels.meta(slide)}</p>}
        </>
      )
  }
}

export function AwardSlide({ slide, labels, onReady }) {
  const { t } = useTranslation('bestOf')
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#141a2e]">
      <FullPhoto media={slide.media} onReady={onReady} className="bestof-reveal" alt={t(`award.${slide.award}`)} />
      <BottomShade />
      <div className="absolute inset-x-0 bottom-0 px-6 pb-10 text-white pointer-events-none">
        <span className="bestof-badge inline-flex items-center gap-2 rounded-full bg-warm-white text-bark px-4 py-2 text-sm font-bold shadow-lg mb-3">
          <Trophy className="w-4 h-4 text-amber-500" aria-hidden="true" />
          {t(`award.${slide.award}`)}
        </span>
        <AwardDetail slide={slide} labels={labels} />
      </div>
    </div>
  )
}

// ── The end ─────────────────────────────────────────────────────────────────

export function DontForgetSlide({ slide, labels, onReady }) {
  const { t } = useTranslation('bestOf')
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#141a2e]">
      <FullPhoto media={slide.media} onReady={onReady} className={motionOf(slide)} />
      <BottomShade />
      <div className="absolute inset-x-0 bottom-0 px-6 pb-12 text-white pointer-events-none">
        <p className="bestof-text text-lg text-white/90 drop-shadow">{t('dontForget')}</p>
        <p className="bestof-text mt-1 text-4xl font-semibold leading-tight drop-shadow-lg" style={{ animationDelay: '0.4s' }}>
          {labels.title}
        </p>
      </div>
    </div>
  )
}

const OUTRO_CARDS = [
  { left: 6, top: 15, width: 42, height: 26, tilt: -7, delay: 0 },
  { left: 50, top: 12, width: 44, height: 28, tilt: 5, delay: 0.15 },
  { left: 14, top: 36, width: 34, height: 19, tilt: 4, delay: 0.3 },
  { left: 52, top: 38, width: 38, height: 18, tilt: -5, delay: 0.45 },
]

// Buttons here sit above the viewer's tap zones; a press on them is theirs.
const own = { onPointerDown: (e) => e.stopPropagation(), onPointerUp: (e) => e.stopPropagation() }

export function OutroSlide({ slide, labels, onReady, onRestart, onRemake }) {
  const { t } = useTranslation('bestOf')
  const media = slide.media || []
  return (
    <div className="absolute inset-0 overflow-hidden bg-cream">
      {OUTRO_CARDS.map((card, i) => media[i] && (
        <div
          key={i}
          className="bestof-drop absolute rounded-3xl overflow-hidden shadow-xl"
          style={{
            left: `${card.left}%`,
            top: `${card.top}%`,
            width: `${card.width}%`,
            height: `${card.height}%`,
            '--bestof-tilt': `${card.tilt}deg`,
            animationDelay: `${card.delay}s`,
          }}
        >
          <SlideImage media={media[i]} onReady={i === 0 ? onReady : undefined} />
        </div>
      ))}
      {!media.some(Boolean) && <ReadyNow onReady={onReady} />}
      <div className="absolute inset-x-6 top-[60%] text-center text-bark">
        <p className="bestof-text text-4xl sm:text-5xl font-bold leading-tight" style={{ animationDelay: '0.5s' }}>{labels.title}</p>
        <p className="bestof-text mt-2 text-lg text-bark-light" style={{ animationDelay: '0.7s' }}>{t('outro.seeYou')}</p>
        <div className="relative z-30 mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            {...own}
            onClick={onRestart}
            className="inline-flex items-center gap-2 rounded-full bg-bark text-white px-6 py-3 text-sm font-semibold shadow-lg hover:bg-bark-light"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            {t('outro.watchAgain')}
          </button>
          {onRemake && (
            <button
              type="button"
              {...own}
              onClick={onRemake}
              title={t('outro.remakeHint', { month: labels.monthName })}
              className="inline-flex items-center gap-2 rounded-full border border-cream-dark bg-warm-white text-bark-light px-5 py-2.5 text-sm font-medium hover:bg-white"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              {t('outro.remake')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
