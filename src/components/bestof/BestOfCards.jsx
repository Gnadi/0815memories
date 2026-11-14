import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomShade, SlideImage } from './BestOfSlides'
import { titleOf } from './bestOfLooks'
import KineticText from './KineticText'

/**
 * The extra cards a style shows (utils/bestOfStyle.js) — the calendar of days
 * kept, the month's rhythm, its places, its first and last moment — and the
 * look back at the same month a year before. Like every slide, each says
 * `onReady` once its first photo is in, or at once when it has none.
 */

// A slide with no photo of its own is ready as soon as it is shown.
function ReadyNow({ onReady }) {
  useEffect(() => {
    onReady?.()
  }, [onReady])
  return null
}

// ── The days something was kept on ──────────────────────────────────────────

export function CalendarSlide({ slide, labels, look, onReady }) {
  const { t } = useTranslation('bestOf')
  const kept = new Set(slide.days || [])
  const total = labels.daysInMonth || 30
  const days = Array.from({ length: total }, (_, i) => i + 1)
  // The marked days light up one after another, in the order of the month.
  const order = new Map([...kept].sort((a, b) => a - b).map((day, i) => [day, i]))
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-[var(--bo-light)] to-[var(--bo-light-2)] text-[var(--bo-ink)]">
      <ReadyNow onReady={onReady} />
      <div className="absolute inset-x-6 top-[17%]">
        <p className="bestof-text text-center text-sm font-semibold uppercase tracking-[0.3em] text-[var(--bo-ink-soft)]">
          {labels.monthYear}
        </p>
        <div className="mt-5 grid grid-cols-7 gap-1.5 text-center text-sm tabular-nums" data-testid="bestof-days">
          {(labels.weekdays || []).map((day, i) => (
            <span key={`w${i}`} className="pb-1 text-xs font-bold text-[var(--bo-ink-soft)]">{day}</span>
          ))}
          {Array.from({ length: labels.firstWeekday || 0 }, (_, i) => <span key={`b${i}`} />)}
          {days.map((day) => (
            kept.has(day)
              ? (
                <span
                  key={day}
                  data-kept="true"
                  className="bestof-tile-pop flex aspect-square items-center justify-center rounded-full bg-[var(--bo-accent)] font-bold text-[var(--bo-on-accent)] shadow"
                  style={{ animationDelay: `${0.4 + order.get(day) * 0.12}s` }}
                >
                  {day}
                </span>
              )
              : <span key={day} className="flex aspect-square items-center justify-center opacity-45">{day}</span>
          ))}
        </div>
      </div>
      <div className="absolute inset-x-6 top-[66%] text-center">
        <KineticText
          text={t('calendar.title', { count: kept.size, total })}
          look={look}
          delay={0.6 + kept.size * 0.12}
          className={`text-3xl sm:text-4xl leading-tight ${titleOf(look)}`}
        />
        <p className="bestof-text mt-1 text-lg text-[var(--bo-ink-soft)]" style={{ animationDelay: `${0.8 + kept.size * 0.12}s` }}>
          {t('calendar.body')}
        </p>
      </div>
    </div>
  )
}

// ── When the family shared ──────────────────────────────────────────────────

const RHYTHMS = ['morning', 'afternoon', 'evening', 'night', 'weekend']

export function RhythmSlide({ slide, look, onReady }) {
  const { t, i18n } = useTranslation('bestOf')
  const percent = new Intl.NumberFormat(i18n.language, { style: 'percent' }).format((slide.percent || 0) / 100)
  const fact = RHYTHMS.includes(slide.fact) ? slide.fact : 'weekend'
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)]">
      {slide.media
        ? (
          <div className="bestof-motion-zoomIn absolute inset-0">
            <SlideImage media={slide.media} onReady={onReady} style={{ filter: 'brightness(0.5)' }} />
          </div>
        )
        : <ReadyNow onReady={onReady} />}
      <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-white">
        <p className="bestof-pop font-black leading-none tabular-nums drop-shadow-lg text-[var(--bo-highlight)]" style={{ fontSize: 'min(24vw, 7.5rem)' }}>
          {percent}
        </p>
        <p className="bestof-text mt-1 text-base text-white/80 drop-shadow" style={{ animationDelay: '0.5s' }}>
          {t('rhythm.share')}
        </p>
        <KineticText
          text={t(`rhythm.${fact}`)}
          look={look}
          delay={0.9}
          className={`mt-5 text-3xl sm:text-4xl leading-tight drop-shadow-lg ${titleOf(look)}`}
        />
      </div>
    </div>
  )
}

// ── Where the family was ────────────────────────────────────────────────────

export function PlacesSlide({ slide, look, onReady }) {
  const { t } = useTranslation('bestOf')
  const places = slide.places || []
  const media = slide.media || []
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)] text-white">
      {/* The first place's photo, far in the background. */}
      <div className="absolute inset-0 scale-[1.2] opacity-40">
        <SlideImage media={media[0]} style={{ filter: 'blur(22px)' }} />
      </div>
      {!media.some(Boolean) && <ReadyNow onReady={onReady} />}
      <div className="absolute inset-x-6 top-[20%]">
        <KineticText text={t('places.title')} look={look} className={`text-4xl leading-tight drop-shadow-lg ${titleOf(look)}`} />
        <ol className="mt-8 space-y-4">
          {places.map((place, i) => (
            <li
              key={place.place}
              className="bestof-tile-left flex items-center gap-4"
              style={{ animationDelay: `${0.4 + i * 0.35}s` }}
            >
              <span className="relative w-20 h-20 shrink-0 overflow-hidden rounded-2xl bg-white/10 shadow-xl">
                <SlideImage media={media[i]} onReady={i === 0 ? onReady : undefined} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-[var(--bo-highlight)]">{i + 1}</span>
                <span className="block text-2xl font-semibold leading-tight break-words drop-shadow">{place.place}</span>
                <span className="block text-sm text-white/75">{t('places.entries', { count: place.entries })}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

// ── How the month began and ended ───────────────────────────────────────────

export function BookendsSlide({ slide, labels, look, onReady }) {
  const { t } = useTranslation('bestOf')
  const [first, last] = slide.media || []
  const [firstDay, lastDay] = slide.days || []
  const half = (media, day, line, className, delay, ready) => (
    <div className={`absolute inset-x-0 overflow-hidden ${className}`}>
      <div className="bestof-motion-zoomIn absolute inset-0">
        <SlideImage media={media} onReady={ready} />
      </div>
      <BottomShade strength="from-black/75" />
      <div className="absolute inset-x-0 bottom-0 px-6 pb-5 text-white pointer-events-none">
        <KineticText text={line} look={look} delay={delay} className="text-2xl font-semibold leading-tight drop-shadow-lg" />
        <p className="bestof-text mt-1 text-sm text-white/80 drop-shadow" style={{ animationDelay: `${delay + 0.2}s` }}>{labels.longDay(day)}</p>
      </div>
    </div>
  )
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)]">
      {first ? half(first, firstDay, t('bookends.first', { month: labels.monthName }), 'top-0 h-[49.5%]', 0.3, onReady) : <ReadyNow onReady={onReady} />}
      {last && half(last, lastDay, t('bookends.last'), 'bottom-0 h-[49.5%] bestof-tile-right', 1.4)}
    </div>
  )
}

// ── The same month a year before ────────────────────────────────────────────

const YEAR_AGO_CARDS = [
  { left: 6, top: 14, tilt: -7, delay: 0.2 },
  { left: 42, top: 19, tilt: 6, delay: 0.5 },
  { left: 22, top: 35, tilt: -2, delay: 0.8 },
]

export function YearAgoSlide({ slide, labels, look, onReady }) {
  const { t } = useTranslation('bestOf')
  const media = (slide.media || []).slice(0, YEAR_AGO_CARDS.length)
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-[var(--bo-light)] to-[var(--bo-light-2)] text-[var(--bo-ink)]">
      {media.map((item, i) => (
        <div
          key={i}
          className="bestof-tile-drop absolute w-[52%]"
          style={{
            left: `${YEAR_AGO_CARDS[i].left}%`,
            top: `${YEAR_AGO_CARDS[i].top}%`,
            '--bestof-tilt': `${YEAR_AGO_CARDS[i].tilt}deg`,
            animationDelay: `${YEAR_AGO_CARDS[i].delay}s`,
          }}
        >
          {/* Last year's prints, a little faded. */}
          <div className="rounded-sm bg-warm-white p-[5%] pb-[16%] shadow-2xl">
            <div className="relative aspect-square overflow-hidden bg-cream-dark">
              <SlideImage media={item} onReady={i === 0 ? onReady : undefined} style={{ filter: 'sepia(0.25) saturate(0.85)' }} />
            </div>
          </div>
        </div>
      ))}
      {media.length === 0 && <ReadyNow onReady={onReady} />}
      <div className="absolute inset-x-6 top-[70%] text-center">
        <KineticText text={t('yearAgo.title')} look={look} delay={1.1} className={`text-4xl leading-tight ${titleOf(look)}`} />
        <p className="bestof-text mt-1 text-lg text-[var(--bo-ink-soft)]" style={{ animationDelay: '1.3s' }}>
          {labels.monthYearOf(slide.month)}
          {slide.photos > 0 && ` · ${t('yearAgo.photos', { count: slide.photos })}`}
        </p>
      </div>
    </div>
  )
}
