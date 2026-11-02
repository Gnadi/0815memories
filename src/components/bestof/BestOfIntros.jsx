import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import useDecryptedMedia from '../media/useDecryptedMedia'
import { BottomShade, IntroSlide, SlideImage } from './BestOfSlides'
import { titleOf } from './bestOfLooks'

/**
 * The opening cards of the looks (bestOfLooks.js), one per `look.intro`: the
 * month's name among its photos in seven different ways, so that the first
 * second of a best-of already says this month is not the last one. The
 * floating photos of IntroSlide are the classic one.
 *
 * Like every slide, each says `onReady` once its first photo is in.
 */

// ── A pile of prints ────────────────────────────────────────────────────────

// Below the controls, which have no shade of their own on a light card.
const PRINTS = [
  { left: 20, top: 17, tilt: -11, delay: 0 },
  { left: 23, top: 19, tilt: 7, delay: 0.25 },
  { left: 19, top: 20, tilt: -4, delay: 0.5 },
  { left: 22, top: 18, tilt: 10, delay: 0.75 },
  { left: 21, top: 20, tilt: -1, delay: 1 },
]

function StackIntro({ slide, labels, look, onReady }) {
  const photos = (slide.media || []).slice(0, PRINTS.length)
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-[var(--bo-light)] to-[var(--bo-light-2)]">
      {photos.map((media, i) => (
        <div
          key={i}
          className="bestof-tile-drop absolute w-[58%]"
          style={{
            left: `${PRINTS[i].left}%`,
            top: `${PRINTS[i].top}%`,
            '--bestof-tilt': `${PRINTS[i].tilt}deg`,
            animationDelay: `${PRINTS[i].delay}s`,
          }}
        >
          <div className="rounded-sm bg-warm-white p-[5%] pb-[18%] shadow-2xl">
            <div className="relative aspect-square overflow-hidden bg-cream-dark">
              <SlideImage media={media} onReady={i === 0 ? onReady : undefined} />
            </div>
          </div>
        </div>
      ))}
      {photos.length === 0 && <ReadyNow onReady={onReady} />}
      <div className="absolute inset-x-6 top-[70%] text-center text-[var(--bo-ink)]">
        <p className={`bestof-text text-5xl sm:text-6xl leading-tight ${titleOf(look)}`} style={{ animationDelay: '1.2s' }}>
          {labels.monthName}
        </p>
        <p className="bestof-text mt-1 text-lg tracking-[0.3em] text-[var(--bo-ink-soft)]" style={{ animationDelay: '1.45s' }}>
          {labels.year}
        </p>
      </div>
    </div>
  )
}

// ── A film's title card ─────────────────────────────────────────────────────

function TitleIntro({ slide, labels, onReady }) {
  const { t } = useTranslation('bestOf')
  const [first] = slide.media || []
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)]">
      <div className="bestof-zoom absolute inset-0 scale-[1.15]">
        <SlideImage media={first} onReady={onReady} style={{ filter: 'blur(10px) brightness(0.45)' }} />
      </div>
      {!first && <ReadyNow onReady={onReady} />}
      <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-white">
        <p className="bestof-text text-sm tracking-[0.5em] text-[var(--bo-highlight)]" style={{ animationDelay: '0.3s' }}>
          {labels.year}
        </p>
        <p className="bestof-title mt-3 text-5xl sm:text-6xl font-semibold uppercase leading-none drop-shadow-lg" style={{ animationDelay: '0.6s' }}>
          {labels.monthName}
        </p>
        <p className="bestof-text mt-5 text-sm uppercase tracking-[0.35em] text-white/70" style={{ animationDelay: '1.6s' }}>
          {t('intro.lookBack')}
        </p>
      </div>
    </div>
  )
}

// ── A magazine's cover ──────────────────────────────────────────────────────

function CoverIntro({ slide, labels, onReady }) {
  const { t } = useTranslation('bestOf')
  const [first] = slide.media || []
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)]">
      <div className="bestof-motion-zoomOut absolute inset-0">
        <SlideImage media={first} onReady={onReady} />
      </div>
      {!first && <ReadyNow onReady={onReady} />}
      <div className="absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
      <BottomShade />
      <div className="absolute left-5 right-5 top-[11%] text-white pointer-events-none">
        <p className="bestof-pop font-display uppercase leading-none drop-shadow-lg" style={{ fontSize: 'min(20vw, 6.5rem)' }}>
          {t('intro.masthead')}
        </p>
        <span
          className="bestof-badge mt-3 inline-block bg-[var(--bo-accent)] px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[var(--bo-on-accent)]"
        >
          {t('intro.issue', { month: labels.monthYear })}
        </span>
      </div>
      <div className="absolute inset-x-5 bottom-0 pb-12 text-white pointer-events-none">
        <p
          className="bestof-text font-display uppercase leading-[0.9] drop-shadow-lg break-words"
          style={{ fontSize: 'min(19vw, 6rem)', animationDelay: '0.6s' }}
        >
          {labels.monthName}
        </p>
      </div>
    </div>
  )
}

// ── A calendar page, torn off ───────────────────────────────────────────────

function CalendarIntro({ slide, labels, look, onReady }) {
  const [first] = slide.media || []
  const days = Array.from({ length: labels.daysInMonth || 30 }, (_, i) => i + 1)
  const blanks = Array.from({ length: labels.firstWeekday || 0 })
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)]">
      <div className="bestof-motion-zoomIn absolute inset-0">
        <SlideImage media={first} onReady={onReady} />
      </div>
      {!first && <ReadyNow onReady={onReady} />}
      <BottomShade />
      <div
        data-testid="bestof-calendar"
        className="bestof-tear absolute left-[9%] right-[9%] top-[15%] rounded-2xl bg-[var(--bo-light)] text-[var(--bo-ink)] shadow-2xl overflow-hidden"
      >
        <div className="bg-[var(--bo-accent)] py-3 text-center text-sm font-bold tracking-[0.4em] text-[var(--bo-on-accent)]">{labels.year}</div>
        <p className={`pt-4 text-center text-4xl ${titleOf(look)}`}>{labels.monthName}</p>
        <div className="grid grid-cols-7 gap-y-1.5 px-4 pt-4 pb-6 text-center text-xs tabular-nums">
          {(labels.weekdays || []).map((day, i) => (
            <span key={`w${i}`} className="font-bold text-[var(--bo-ink-soft)]">{day}</span>
          ))}
          {blanks.map((_, i) => <span key={`b${i}`} />)}
          {days.map((day) => <span key={day}>{day}</span>)}
        </div>
      </div>
      <div className="absolute inset-x-6 bottom-0 pb-12 text-white pointer-events-none">
        <p className={`bestof-text text-4xl leading-tight drop-shadow-lg ${titleOf(look)}`} style={{ animationDelay: '2.4s' }}>
          {labels.monthYear}
        </p>
      </div>
    </div>
  )
}

// ── Tiles around the month's name ───────────────────────────────────────────

const COLUMNS = 3
const ROWS = 5
// The middle row is the name's.
const NAME_ROW = 2

function MosaicIntro({ slide, labels, onReady }) {
  const photos = (slide.media || []).filter(Boolean)
  const tiles = []
  for (let row = 0; row < ROWS; row++) {
    if (row === NAME_ROW) continue
    for (let column = 0; column < COLUMNS; column++) tiles.push({ row, column })
  }
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)]">
      {photos.length > 0 && tiles.map(({ row, column }, i) => (
        <div
          key={i}
          className="bestof-tile-pop absolute overflow-hidden rounded-xl"
          style={{
            left: `${2 + column * 32.67}%`,
            top: `${1.5 + row * 19.7}%`,
            width: '31%',
            height: '18.5%',
            animationDelay: `${(row + column) * 0.09}s`,
          }}
        >
          {/* A photo appears in several tiles, each a different part of the
              month: they go round the list in a different order per row. */}
          <SlideImage
            media={photos[(i * 2 + row) % photos.length]}
            onReady={i === 0 ? onReady : undefined}
            style={{ filter: 'brightness(0.85)' }}
          />
        </div>
      ))}
      {photos.length === 0 && <ReadyNow onReady={onReady} />}
      <div className="absolute inset-x-0 flex flex-col items-center justify-center text-white" style={{ top: '41%', height: '18%' }}>
        <p className="bestof-pop font-display uppercase leading-none drop-shadow-lg" style={{ fontSize: 'min(22vw, 7rem)', animationDelay: '0.9s' }}>
          {labels.monthShort}
        </p>
        <p className="bestof-text mt-1 text-sm font-semibold tracking-[0.4em] text-[var(--bo-highlight)]" style={{ animationDelay: '1.3s' }}>
          {labels.year}
        </p>
      </div>
    </div>
  )
}

// ── The name cut out of a photo ─────────────────────────────────────────────

function MaskIntro({ slide, labels, onReady }) {
  const [first] = slide.media || []
  const { decryptedUrl, error } = useDecryptedMedia(first?.thumbUrl || first?.url || '', 'image/*')
  const reported = useRef(false)
  const image = decryptedUrl || first?.tiny || ''
  useEffect(() => {
    if (reported.current || !(decryptedUrl || error || !first)) return
    reported.current = true
    onReady?.()
  }, [decryptedUrl, error, first, onReady])
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-light)]">
      <div className="absolute inset-x-0 top-[36%] flex flex-col items-center">
        <p
          data-testid="bestof-mask"
          className="bestof-mask font-display uppercase leading-none text-[var(--bo-ink)]"
          style={{
            fontSize: 'min(34vw, 11rem)',
            ...(image
              ? {
                backgroundImage: `url("${image}")`,
                backgroundSize: '160% auto',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }
              : null),
          }}
        >
          {labels.monthShort}
        </p>
        <p className="bestof-text mt-4 text-base tracking-[0.6em] text-[var(--bo-ink-soft)]" style={{ animationDelay: '0.9s' }}>
          {labels.year}
        </p>
      </div>
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

const INTROS = {
  floating: IntroSlide,
  stack: StackIntro,
  title: TitleIntro,
  cover: CoverIntro,
  calendar: CalendarIntro,
  mosaic: MosaicIntro,
  mask: MaskIntro,
}

/** The opening card of the best-of's look. */
export function StyledIntro(props) {
  const Intro = INTROS[props.look?.intro] || IntroSlide
  return <Intro {...props} />
}
