import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Trophy } from 'lucide-react'
import {
  AwardDetail,
  AwardIntroSlide,
  AwardSlide,
  BottomShade,
  CountSlide,
  FullPhoto,
  PhotoSlide,
  SlideImage,
  ThemesSlide,
} from './BestOfSlides'
import { motionClass, variantOf } from './bestOfLooks'
import useCountUp from './useCountUp'
import KineticText, { RollingNumber } from './KineticText'

/**
 * The slides each look draws its own way (bestOfLooks.js, `variants`), so
 * that it is not only the opening card that changes from month to month: a
 * single photo is a print on a table in one month, a magazine page in the
 * next, a film still with subtitles in the one after. The same goes for the
 * count, the themes, and an award's announcement and the award itself.
 *
 * Each is drawn from the same slide as the classic one, so a best-of can be
 * shown in any look, and a variant this version does not know falls back to
 * the classic slide.
 */

// A slide with no photo of its own is ready as soon as it is shown.
function ReadyNow({ onReady }) {
  useEffect(() => {
    onReady?.()
  }, [onReady])
  return null
}

const delay = (seconds) => ({ animationDelay: `${seconds}s` })

// ── A single photo ──────────────────────────────────────────────────────────

// A print on a table of its own photo, blurred, with the caption written on
// the print. It leans one way or the other from day to day.
function PrintPhoto({ slide, labels, look, onReady }) {
  const tilt = Number(slide.day?.slice(8) || 0) % 2 ? -3 : 2.5
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)]">
      <div className="absolute inset-0 scale-[1.2]">
        <SlideImage media={slide.media} style={{ filter: 'blur(24px) brightness(0.45)' }} />
      </div>
      <div className="bestof-tile-drop absolute left-[8%] w-[84%] top-[14%]" style={{ '--bestof-tilt': `${tilt}deg` }}>
        <div className="bestof-float3d rounded-sm bg-warm-white p-[4%] shadow-2xl">
          <div className="relative aspect-[4/5] overflow-hidden bg-cream-dark">
            <FullPhoto media={slide.media} onReady={onReady} className={motionClass(slide)} alt={slide.caption || ''} />
          </div>
          <div className="px-1 pt-3 pb-1 text-bark">
            <KineticText text={slide.caption} look={look} delay={0.6} className="font-serif italic text-xl leading-snug" />
            {labels.meta(slide) && <p className="bestof-text mt-0.5 text-sm text-bark-light" style={delay(0.8)}>{labels.meta(slide)}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

// A film still: the date and place stamped in the corner like a camera's,
// and the caption as a subtitle above the black bar.
function SubtitlePhoto({ slide, labels, look, onReady }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)]">
      <FullPhoto media={slide.media} onReady={onReady} className={motionClass(slide)} alt={slide.caption || ''} />
      <BottomShade strength="from-black/50" />
      {labels.meta(slide) && (
        <p className="bestof-text absolute left-5 top-[15%] font-mono text-xs uppercase tracking-[0.25em] text-[var(--bo-highlight)] drop-shadow" style={delay(0.5)}>
          {labels.meta(slide)}
        </p>
      )}
      <KineticText
        text={slide.caption}
        look={look}
        delay={0.8}
        className="absolute inset-x-8 bottom-[11%] text-center text-lg font-medium leading-snug text-[#fff6c8] [text-shadow:0_1px_3px_rgb(0_0_0/0.9)]"
      />
    </div>
  )
}

// A magazine page: the photo above, the headline and its kicker on the page
// below.
function PagePhoto({ slide, labels, look, onReady }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-light)] text-[var(--bo-ink)]">
      <div className="absolute inset-x-0 top-0 h-[64%] overflow-hidden">
        <FullPhoto media={slide.media} onReady={onReady} className={motionClass(slide)} alt={slide.caption || ''} />
      </div>
      <div className="absolute inset-x-6 top-[67%]">
        {labels.meta(slide) && (
          <p className="bestof-text text-xs font-bold uppercase tracking-[0.25em] text-[var(--bo-accent)]" style={delay(0.3)}>{labels.meta(slide)}</p>
        )}
        <KineticText
          text={slide.caption || labels.monthName}
          look={look}
          delay={0.5}
          className="mt-2 font-display uppercase leading-[0.95] text-[2.6rem] break-words"
        />
        <div className="bestof-tile-left mt-3 h-1 w-16 bg-[var(--bo-accent)]" style={delay(0.8)} />
      </div>
    </div>
  )
}

// The caption as a sticker slapped onto the photo, at an angle.
function StickerPhoto({ slide, labels, look, onReady }) {
  const meta = labels.meta(slide)
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)]">
      <FullPhoto media={slide.media} onReady={onReady} className={motionClass(slide)} alt={slide.caption || ''} />
      <BottomShade strength="from-black/40" />
      <div className="absolute inset-x-5 bottom-12 flex flex-col items-start gap-2 pointer-events-none">
        {slide.caption && (
          <span className="bestof-stamp rounded-2xl bg-[var(--bo-accent)] px-5 py-3 text-2xl font-black leading-tight text-[var(--bo-on-accent)] shadow-xl" style={{ '--bestof-tilt': '-3deg', ...delay(0.4) }}>
            <KineticText as="span" text={slide.caption} look={look} delay={0.6} />
          </span>
        )}
        {meta && (
          <span className="bestof-stamp rounded-full bg-white px-4 py-1.5 text-sm font-bold text-[var(--bo-dark)] shadow-lg" style={{ '--bestof-tilt': '2deg', ...delay(0.7) }}>
            {meta}
          </span>
        )}
      </div>
    </div>
  )
}

// A diary page: the day written at the top, the photo taped in, the caption
// written under it.
function JournalPhoto({ slide, labels, look, onReady }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-light)] text-[var(--bo-ink)]">
      <p className="bestof-text absolute inset-x-7 top-[14%] font-serif italic text-2xl border-b border-[var(--bo-ink)]/20 pb-1">
        {labels.longDay(slide.day)}
      </p>
      <div className="bestof-tile-pop absolute left-[9%] w-[82%] top-[23%]" style={delay(0.2)}>
        <div className="bestof-float3d relative bg-warm-white p-[3%] shadow-xl" style={{ rotate: '-1.5deg' }}>
          <div className="relative aspect-[4/5] overflow-hidden bg-cream-dark">
            <FullPhoto media={slide.media} onReady={onReady} className={motionClass(slide)} alt={slide.caption || ''} />
          </div>
          <span aria-hidden="true" className="absolute left-1/2 -top-3 h-6 w-[34%] -translate-x-1/2 rotate-2 bg-white/60 shadow-sm" />
        </div>
      </div>
      <div className="absolute inset-x-7 bottom-[7%]">
        <KineticText text={slide.caption} look={look} delay={0.7} className="font-serif italic text-xl leading-snug" />
        {slide.location && <p className="bestof-text mt-0.5 text-sm text-[var(--bo-ink-soft)]" style={delay(0.9)}>{slide.location}</p>}
      </div>
    </div>
  )
}

// Tiles lifting off the photo one after another, and the caption in a block
// of the accent.
const TILE_COLUMNS = 4
const TILE_ROWS = 7

function TilesPhoto({ slide, labels, look, onReady }) {
  const meta = labels.meta(slide)
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)]">
      <FullPhoto media={slide.media} onReady={onReady} className={motionClass(slide)} alt={slide.caption || ''} />
      <div className="absolute inset-0 grid grid-cols-4 grid-rows-7 pointer-events-none" aria-hidden="true">
        {Array.from({ length: TILE_COLUMNS * TILE_ROWS }, (_, i) => (
          <span
            key={i}
            className="bestof-tile-out bg-[var(--bo-dark)]"
            style={delay(0.15 + (((i * 7) % (TILE_COLUMNS * TILE_ROWS)) * 0.025))}
          />
        ))}
      </div>
      <div className="absolute left-0 bottom-10 max-w-[85%] pointer-events-none">
        {slide.caption && (
          <p className="bestof-tile-left bg-[var(--bo-accent)] px-5 py-3 text-xl font-bold leading-snug text-[var(--bo-on-accent)]" style={delay(1)}>
            <KineticText as="span" text={slide.caption} look={look} delay={1.2} />
          </p>
        )}
        {meta && (
          <p className="bestof-tile-left inline-block bg-[var(--bo-dark)] px-5 py-2 text-sm text-white/85" style={delay(1.2)}>{meta}</p>
        )}
      </div>
    </div>
  )
}

// A photo in a wide white mount, the caption small beneath it.
function PassepartoutPhoto({ slide, labels, look, onReady }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-light)] text-[var(--bo-ink)]">
      <div className="absolute left-[9%] right-[9%] top-[15%] bottom-[27%] overflow-hidden shadow-sm">
        <FullPhoto media={slide.media} onReady={onReady} className={motionClass(slide)} alt={slide.caption || ''} />
      </div>
      <div className="absolute inset-x-[9%] top-[76%]">
        <KineticText text={slide.caption} look={look} delay={0.6} className="text-xl font-light leading-snug" />
        {labels.meta(slide) && (
          <p className="bestof-text mt-1 text-xs uppercase tracking-[0.25em] text-[var(--bo-ink-soft)]" style={delay(0.8)}>{labels.meta(slide)}</p>
        )}
      </div>
    </div>
  )
}

const PHOTOS = {
  print: PrintPhoto,
  subtitle: SubtitlePhoto,
  page: PagePhoto,
  sticker: StickerPhoto,
  journal: JournalPhoto,
  tiles: TilesPhoto,
  passepartout: PassepartoutPhoto,
}

// ── The month in numbers ────────────────────────────────────────────────────

function useCount(slide) {
  const { t, i18n } = useTranslation('bestOf')
  const total = (slide.photos || 0) + (slide.videos || 0)
  const shown = useCountUp(total)
  return {
    total,
    shown,
    text: shown.toLocaleString(i18n.language),
    locale: i18n.language,
    label: slide.videos > 0 ? t('count.photosAndVideos') : t('count.photos', { count: slide.photos }),
  }
}

// A pile of prints with the number written on the top one.
function StackCount({ slide, onReady }) {
  const { text, label } = useCount(slide)
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-[var(--bo-light)] to-[var(--bo-light-2)] text-[var(--bo-ink)]">
      {[-9, 6].map((tilt, i) => (
        <div
          key={tilt}
          className="bestof-tile-drop absolute left-[14%] w-[72%] top-[20%] aspect-[4/5] rounded-sm bg-warm-white shadow-xl"
          style={{ '--bestof-tilt': `${tilt}deg`, ...delay(i * 0.2) }}
        />
      ))}
      <div className="bestof-tile-drop absolute left-[14%] w-[72%] top-[20%]" style={{ '--bestof-tilt': '-1deg', ...delay(0.4) }}>
        <div className="rounded-sm bg-warm-white p-[4%] shadow-2xl">
          <div className="relative aspect-square overflow-hidden bg-cream-dark">
            <SlideImage media={slide.media} onReady={onReady} />
          </div>
          <p className="pt-3 text-center font-black leading-none tabular-nums text-bark" style={{ fontSize: 'min(18vw, 5rem)' }}>{text}</p>
          <p className="pb-2 text-center font-serif italic text-lg text-bark-light">{label}</p>
        </div>
      </div>
      {!slide.media && <ReadyNow onReady={onReady} />}
    </div>
  )
}

// A film's counter: one digit to a box, in gold, over a dim still.
function CounterCount({ slide, onReady }) {
  const { total, shown, label } = useCount(slide)
  const digits = String(shown).padStart(String(total).length, '0').split('')
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)]">
      <div className="absolute inset-0 scale-[1.15]">
        <div className="bestof-zoom absolute inset-0">
          <SlideImage media={slide.media} onReady={onReady} style={{ filter: 'blur(14px) brightness(0.3)' }} />
        </div>
      </div>
      {!slide.media && <ReadyNow onReady={onReady} />}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center">
        <div className="flex gap-2" data-testid="bestof-counter">
          {digits.map((digit, i) => (
            <span key={i} className="flex h-24 w-16 items-center justify-center rounded-md border border-[var(--bo-accent)]/40 bg-black/60 font-mono text-6xl text-[var(--bo-highlight)] shadow-xl">
              {digit}
            </span>
          ))}
        </div>
        <p className="bestof-text mt-6 text-sm uppercase tracking-[0.4em] text-white/80" style={delay(0.9)}>{label}</p>
      </div>
    </div>
  )
}

// A magazine's big number: the figure running off the page, the photo in a
// box beside it.
function GiantCount({ slide, onReady }) {
  const { total, locale, label } = useCount(slide)
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-light)] text-[var(--bo-ink)]">
      <div className="bestof-tile-right absolute right-0 top-[15%] h-[40%] w-[58%] overflow-hidden">
        <SlideImage media={slide.media} onReady={onReady} />
      </div>
      {!slide.media && <ReadyNow onReady={onReady} />}
      <p className="absolute left-4 top-[44%] font-display leading-[0.85] tabular-nums" style={{ fontSize: 'min(52vw, 15rem)' }}>
        <RollingNumber value={total} locale={locale} />
      </p>
      <p className="bestof-text absolute left-6 bottom-[10%] text-sm font-bold uppercase tracking-[0.3em] text-[var(--bo-accent)]" style={delay(0.8)}>
        {label}
      </p>
    </div>
  )
}

// The number bursting out of turning rays.
function BurstCount({ slide, onReady }) {
  const { text, label } = useCount(slide)
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)]">
      <div className="absolute inset-0 scale-[1.15] opacity-40">
        <div className="bestof-zoom absolute inset-0">
          <SlideImage media={slide.media} onReady={onReady} style={{ filter: 'blur(10px)' }} />
        </div>
      </div>
      {!slide.media && <ReadyNow onReady={onReady} />}
      <div className="bestof-rays absolute left-1/2 top-1/2 h-[160%] aspect-square -translate-x-1/2 -translate-y-1/2" aria-hidden="true" />
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center">
        <p className="bestof-pop font-black leading-none tabular-nums text-white drop-shadow-lg" style={{ fontSize: 'min(34vw, 10rem)' }}>{text}</p>
        <span className="bestof-stamp mt-4 rounded-full bg-[var(--bo-accent)] px-5 py-2 text-lg font-black text-[var(--bo-on-accent)] shadow-xl" style={{ '--bestof-tilt': '-4deg', ...delay(0.8) }}>
          {label}
        </span>
      </div>
    </div>
  )
}

// Tally marks on the diary's page, drawn one after another, in fives.
const MAX_TALLY = 30

function TallyCount({ slide, onReady }) {
  const { total, text, label } = useCount(slide)
  const marks = Math.min(total, MAX_TALLY)
  const groups = Array.from({ length: Math.ceil(marks / 5) }, (_, g) => Math.min(5, marks - g * 5))
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-light)] text-[var(--bo-ink)]">
      <ReadyNow onReady={onReady} />
      <div className="absolute inset-x-8 top-[20%] flex flex-wrap gap-x-5 gap-y-4" data-testid="bestof-tally">
        {groups.map((count, g) => (
          <svg key={g} viewBox="0 0 48 40" className="h-10 w-12 text-[var(--bo-ink)]" aria-hidden="true">
            {Array.from({ length: Math.min(count, 4) }, (_, i) => (
              <line
                key={i}
                x1={6 + i * 10} y1="4" x2={4 + i * 10} y2="36"
                className="bestof-draw" pathLength="1" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                style={delay(0.2 + (g * 5 + i) * 0.07)}
              />
            ))}
            {count === 5 && (
              <line
                x1="0" y1="30" x2="44" y2="10"
                className="bestof-draw" pathLength="1" stroke="var(--bo-accent)" strokeWidth="3" strokeLinecap="round"
                style={delay(0.2 + (g * 5 + 4) * 0.07)}
              />
            )}
          </svg>
        ))}
      </div>
      <div className="absolute inset-x-8 top-[60%]">
        <p className="bestof-text font-serif italic leading-none tabular-nums" style={{ fontSize: 'min(28vw, 8rem)', ...delay(0.4) }}>
          {text}{total > MAX_TALLY && '…'}
        </p>
        <p className="bestof-text mt-2 font-serif italic text-2xl text-[var(--bo-ink-soft)]" style={delay(0.7)}>{label}</p>
      </div>
    </div>
  )
}

// One small square for every photo and clip, up to a few dozen, filling in.
const MAX_SQUARES = 48

function SquaresCount({ slide, onReady }) {
  const { total, locale, label } = useCount(slide)
  const squares = Math.min(total, MAX_SQUARES)
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)] text-white">
      <ReadyNow onReady={onReady} />
      <div className="absolute inset-x-8 top-[17%] grid grid-cols-8 gap-1.5" data-testid="bestof-squares">
        {Array.from({ length: squares }, (_, i) => (
          <span key={i} className="bestof-tile-pop aspect-square rounded-[3px] bg-[var(--bo-accent)]" style={delay(0.1 + i * 0.03)} />
        ))}
      </div>
      <div className="absolute inset-x-8 bottom-[14%]">
        <p className="font-display leading-none tabular-nums" style={{ fontSize: 'min(30vw, 9rem)' }}>
          <RollingNumber value={total} locale={locale} delay={0.4} />
        </p>
        <p className="bestof-text mt-2 text-lg font-semibold text-[var(--bo-highlight)]" style={delay(0.8)}>{label}</p>
      </div>
    </div>
  )
}

// Only the number, thin and large, and a line under it.
function PlainCount({ slide, onReady }) {
  const { total, locale, label } = useCount(slide)
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-light)] text-[var(--bo-ink)]">
      <ReadyNow onReady={onReady} />
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center">
        <p className="font-extralight leading-none tabular-nums" style={{ fontSize: 'min(42vw, 12rem)' }}>
          <RollingNumber value={total} locale={locale} />
        </p>
        <div className="bestof-tile-left mt-4 h-px w-24 bg-[var(--bo-ink)]" style={delay(0.6)} />
        <p className="bestof-text mt-4 text-sm uppercase tracking-[0.35em] text-[var(--bo-ink-soft)]" style={delay(0.8)}>{label}</p>
      </div>
    </div>
  )
}

const COUNTS = {
  stack: StackCount,
  counter: CounterCount,
  giant: GiantCount,
  burst: BurstCount,
  tally: TallyCount,
  squares: SquaresCount,
  plain: PlainCount,
}

// ── What the month was about ────────────────────────────────────────────────

// Title cards: the themes one after another over a dim still.
function TitlesThemes({ slide, labels, onReady }) {
  const [first] = (slide.media || []).filter(Boolean)
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)] text-white">
      <div className="bestof-zoom absolute inset-0 scale-[1.15]">
        <SlideImage media={first} onReady={onReady} style={{ filter: 'blur(8px) brightness(0.35)' }} />
      </div>
      {!first && <ReadyNow onReady={onReady} />}
      <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center">
        <p className="bestof-text text-xs uppercase tracking-[0.5em] text-[var(--bo-highlight)]">{labels.monthYear}</p>
        {slide.themes.map((theme, i) => (
          <p key={theme} className="bestof-title mt-5 text-3xl font-semibold uppercase leading-tight break-words" style={delay(0.4 + i * 0.6)}>
            {theme}
          </p>
        ))}
      </div>
    </div>
  )
}

// A magazine's contents: numbered, in big type, a thumbnail each.
function ListThemes({ slide, labels, onReady }) {
  const media = slide.media || []
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-light)] text-[var(--bo-ink)]">
      {!media.some(Boolean) && <ReadyNow onReady={onReady} />}
      <p className="bestof-text absolute inset-x-6 top-[15%] text-xs font-bold uppercase tracking-[0.3em] text-[var(--bo-accent)]">{labels.monthYear}</p>
      <ol className="absolute inset-x-6 top-[21%]">
        {slide.themes.map((theme, i) => (
          <li key={theme} className="bestof-tile-left flex items-center gap-4 border-b border-[var(--bo-ink)]/15 py-4" style={delay(0.2 + i * 0.25)}>
            <span className="font-display text-2xl text-[var(--bo-accent)]">{String(i + 1).padStart(2, '0')}</span>
            <span className="min-w-0 flex-1 font-display uppercase text-3xl leading-none break-words">{theme}</span>
            {media[i] && (
              <span className="relative h-16 w-16 shrink-0 overflow-hidden">
                <SlideImage media={media[i]} onReady={i === 0 ? onReady : undefined} />
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

// Stickers in different colours, slapped onto the month's photo.
const STICKER_COLORS = ['var(--bo-accent)', '#ffd166', '#06d6a0']
const STICKER_SPOTS = [
  { left: 8, top: 28, tilt: -6 },
  { left: 30, top: 45, tilt: 4 },
  { left: 12, top: 62, tilt: -2 },
]

function StickersThemes({ slide, labels, onReady }) {
  const [first] = (slide.media || []).filter(Boolean)
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)]">
      <div className="absolute inset-0">
        <SlideImage media={first} onReady={onReady} style={{ filter: 'brightness(0.55)' }} />
      </div>
      {!first && <ReadyNow onReady={onReady} />}
      {slide.themes.map((theme, i) => (
        <span
          key={theme}
          className="bestof-stamp absolute max-w-[80%] rounded-2xl px-5 py-3 text-3xl font-black leading-tight shadow-2xl break-words"
          style={{
            left: `${STICKER_SPOTS[i % 3].left}%`,
            top: `${STICKER_SPOTS[i % 3].top}%`,
            background: STICKER_COLORS[i % 3],
            color: i % 3 ? '#1d1340' : 'var(--bo-on-accent)',
            '--bestof-tilt': `${STICKER_SPOTS[i % 3].tilt}deg`,
            ...delay(0.3 + i * 0.35),
          }}
        >
          {theme}
        </span>
      ))}
      <p className="bestof-text absolute inset-x-6 bottom-10 text-lg font-bold text-white drop-shadow" style={delay(1.4)}>{labels.monthYear}</p>
    </div>
  )
}

// A diary's list, each theme ticked off, and a photo taped beneath.
function NotesThemes({ slide, labels, onReady }) {
  const [first] = (slide.media || []).filter(Boolean)
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-light)] text-[var(--bo-ink)]">
      <p className="bestof-text absolute inset-x-8 top-[14%] font-serif italic text-2xl border-b border-[var(--bo-ink)]/20 pb-1">{labels.monthYear}</p>
      <ul className="absolute inset-x-8 top-[23%] space-y-3">
        {slide.themes.map((theme, i) => (
          <li key={theme} className="bestof-text flex items-center gap-3 font-serif italic text-3xl" style={delay(0.3 + i * 0.4)}>
            <Check className="h-6 w-6 shrink-0 text-[var(--bo-accent)]" strokeWidth={3} aria-hidden="true" />
            <span className="break-words">{theme}</span>
          </li>
        ))}
      </ul>
      {first
        ? (
          <div className="bestof-tile-pop absolute left-[22%] w-[56%] bottom-[9%]" style={delay(1.2)}>
            <div className="relative bg-warm-white p-[4%] shadow-xl" style={{ rotate: '3deg' }}>
              <div className="relative aspect-[4/3] overflow-hidden bg-cream-dark">
                <SlideImage media={first} onReady={onReady} />
              </div>
              <span aria-hidden="true" className="absolute left-1/2 -top-3 h-6 w-[38%] -translate-x-1/2 -rotate-3 bg-white/60 shadow-sm" />
            </div>
          </div>
        )
        : <ReadyNow onReady={onReady} />}
    </div>
  )
}

// Three bands across the slide, each a theme over its photo.
function TilesThemes({ slide, onReady }) {
  const media = slide.media || []
  const count = slide.themes.length
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)]">
      {!media.some(Boolean) && <ReadyNow onReady={onReady} />}
      {slide.themes.map((theme, i) => (
        <div
          key={theme}
          className={`${i % 2 ? 'bestof-tile-right' : 'bestof-tile-left'} absolute inset-x-[3%] overflow-hidden rounded-xl bg-white/10`}
          style={{ top: `${12 + (i * 84) / count}%`, height: `${84 / count - 1.5}%`, ...delay(i * 0.25) }}
        >
          <SlideImage media={media[i]} onReady={i === 0 ? onReady : undefined} style={{ filter: 'brightness(0.75)' }} />
          <span className="absolute left-0 bottom-4 bg-[var(--bo-accent)] px-4 py-2 text-2xl font-bold text-[var(--bo-on-accent)] break-words max-w-[90%]">
            {theme}
          </span>
        </div>
      ))}
    </div>
  )
}

// One line, thin, with a single photo above it.
function LineThemes({ slide, labels, onReady }) {
  const [first] = (slide.media || []).filter(Boolean)
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-light)] text-[var(--bo-ink)]">
      {first
        ? (
          <div className="bestof-tile-pop absolute left-[22%] right-[22%] top-[17%] aspect-[4/5] overflow-hidden">
            <SlideImage media={first} onReady={onReady} />
          </div>
        )
        : <ReadyNow onReady={onReady} />}
      <div className="absolute inset-x-8 top-[64%] text-center">
        <p className="bestof-text text-3xl font-light leading-snug break-words" style={delay(0.5)}>{slide.themes.join(' · ')}</p>
        <p className="bestof-text mt-3 text-xs uppercase tracking-[0.35em] text-[var(--bo-ink-soft)]" style={delay(0.8)}>{labels.monthYear}</p>
      </div>
    </div>
  )
}

const THEMES = {
  titles: TitlesThemes,
  list: ListThemes,
  stickers: StickersThemes,
  notes: NotesThemes,
  tiles: TilesThemes,
  line: LineThemes,
}

// ── An award's announcement ─────────────────────────────────────────────────

function useAnnouncement(slide) {
  const { t } = useTranslation('bestOf')
  return t(`awardIntro.${slide.award}`)
}

// A spotlight sweeping the dark stage and settling on the words.
function SpotlightIntro({ slide, look, onReady }) {
  const text = useAnnouncement(slide)
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <ReadyNow onReady={onReady} />
      <div className="bestof-spotlight absolute left-1/2 top-1/2 h-[70%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(255_244_200/0.35),transparent_65%)]" aria-hidden="true" />
      <KineticText
        text={text}
        look={look}
        delay={1}
        className="absolute inset-x-8 top-1/2 -translate-y-1/2 text-center text-2xl font-semibold uppercase leading-snug tracking-[0.12em] text-white"
      />
    </div>
  )
}

// The words in big type on the accent, left aligned, like a headline.
function AccentIntro({ slide, look, onReady }) {
  const text = useAnnouncement(slide)
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-accent)] text-[var(--bo-on-accent)]">
      <ReadyNow onReady={onReady} />
      <KineticText
        text={text}
        look={look}
        mode="mask"
        className="absolute inset-x-6 top-1/2 -translate-y-1/2 font-display uppercase leading-[0.95] text-5xl break-words"
      />
    </div>
  )
}

// A drumroll: the words shaking over turning rays.
function RaysIntro({ slide, onReady }) {
  const text = useAnnouncement(slide)
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)]">
      <div className="absolute inset-0 scale-[1.2] opacity-50">
        <SlideImage media={slide.media} onReady={onReady} style={{ filter: 'blur(26px)' }} />
      </div>
      {!slide.media && <ReadyNow onReady={onReady} />}
      <div className="bestof-rays absolute left-1/2 top-1/2 h-[160%] aspect-square -translate-x-1/2 -translate-y-1/2" aria-hidden="true" />
      <p className="bestof-drumroll absolute inset-x-8 top-1/2 -translate-y-1/2 text-center text-[2rem] font-black leading-tight text-white drop-shadow-lg">
        {text}
      </p>
    </div>
  )
}

// Written on the page, with a line drawn under it.
function PaperIntro({ slide, look, onReady }) {
  const text = useAnnouncement(slide)
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-light)] text-[var(--bo-ink)]">
      <ReadyNow onReady={onReady} />
      <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 text-center">
        <KineticText text={text} look={look} className="font-serif italic text-[2rem] leading-snug" />
        <svg viewBox="0 0 200 12" className="mx-auto mt-3 w-40 text-[var(--bo-accent)]" aria-hidden="true">
          <path d="M2 8 C 50 2, 120 12, 198 4" className="bestof-draw" pathLength="1" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={delay(0.8)} />
        </svg>
      </div>
    </div>
  )
}

// Only the words, thin, on white.
function PlainIntro({ slide, look, onReady }) {
  const text = useAnnouncement(slide)
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-light)] text-[var(--bo-ink)]">
      <ReadyNow onReady={onReady} />
      <KineticText text={text} look={look} className="absolute inset-x-10 top-1/2 -translate-y-1/2 text-center text-3xl font-light leading-snug" />
    </div>
  )
}

const AWARD_INTROS = {
  spotlight: SpotlightIntro,
  accent: AccentIntro,
  rays: RaysIntro,
  paper: PaperIntro,
  plain: PlainIntro,
}

// ── The award ───────────────────────────────────────────────────────────────

function useAwardName(slide) {
  const { t } = useTranslation('bestOf')
  return t(`award.${slide.award}`)
}

// A rubber stamp landing on the photo.
function StampAward({ slide, labels, look, onReady }) {
  const name = useAwardName(slide)
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)]">
      <FullPhoto media={slide.media} onReady={onReady} className="bestof-reveal" alt={name} />
      <BottomShade />
      <span
        className="bestof-stamp absolute right-6 top-[17%] rounded-lg border-4 border-[var(--bo-accent)] bg-[var(--bo-light)]/85 px-4 py-2 text-lg font-black uppercase tracking-wider text-[var(--bo-accent)] shadow-lg"
        style={{ '--bestof-tilt': '-8deg', ...delay(0.6) }}
      >
        {name}
      </span>
      <div className="absolute inset-x-0 bottom-0 px-6 pb-10 text-white pointer-events-none">
        <AwardDetail slide={slide} labels={labels} look={look} />
      </div>
    </div>
  )
}

// Like a film's credits: the category in small gold capitals, the winner
// large, centred over the still.
function CreditsAward({ slide, labels, look, onReady }) {
  const name = useAwardName(slide)
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)]">
      <div className="absolute inset-0 brightness-[0.55]">
        <FullPhoto media={slide.media} onReady={onReady} className="bestof-reveal" alt={name} />
      </div>
      <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 text-center text-white pointer-events-none">
        <p className="bestof-text text-xs uppercase tracking-[0.45em] text-[var(--bo-highlight)]" style={delay(0.4)}>{name}</p>
        <div className="mt-4">
          <AwardDetail slide={slide} labels={labels} look={look} />
        </div>
      </div>
    </div>
  )
}

// A banner across the top in the accent, sliding in.
function BannerAward({ slide, labels, look, onReady }) {
  const name = useAwardName(slide)
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)]">
      <FullPhoto media={slide.media} onReady={onReady} className="bestof-reveal" alt={name} />
      <BottomShade />
      <p className="bestof-tile-left absolute left-0 top-[15%] max-w-[90%] bg-[var(--bo-accent)] px-6 py-3 font-display uppercase text-3xl leading-none text-[var(--bo-on-accent)] shadow-xl" style={delay(0.5)}>
        {name}
      </p>
      <div className="absolute inset-x-0 bottom-0 px-6 pb-10 text-white pointer-events-none">
        <AwardDetail slide={slide} labels={labels} look={look} />
      </div>
    </div>
  )
}

// The award in a white pill above the winner.
function BadgeAward({ slide, labels, look, onReady }) {
  const name = useAwardName(slide)
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)]">
      <FullPhoto media={slide.media} onReady={onReady} className="bestof-reveal" alt={name} />
      <BottomShade />
      <div className="absolute inset-x-0 bottom-0 px-6 pb-10 text-white pointer-events-none">
        <span className="bestof-badge mb-3 inline-block rounded-full bg-white px-4 py-1.5 text-sm font-black text-[var(--bo-dark)] shadow-lg">{name}</span>
        <AwardDetail slide={slide} labels={labels} look={look} />
      </div>
    </div>
  )
}

// The photo in a white mount, the award beneath it in small capitals.
function BelowAward({ slide, labels, look, onReady }) {
  const name = useAwardName(slide)
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-light)] text-[var(--bo-ink)]">
      <div className="absolute left-[9%] right-[9%] top-[15%] bottom-[34%] overflow-hidden">
        <FullPhoto media={slide.media} onReady={onReady} className="bestof-reveal" alt={name} />
      </div>
      <div className="absolute inset-x-[9%] top-[69%]">
        <p className="bestof-text flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-[var(--bo-ink-soft)]" style={delay(0.4)}>
          <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
          {name}
        </p>
        <div className="mt-2 font-light">
          <AwardDetail slide={slide} labels={labels} look={look} light />
        </div>
      </div>
    </div>
  )
}

const AWARDS = {
  stamp: StampAward,
  credits: CreditsAward,
  banner: BannerAward,
  badge: BadgeAward,
  below: BelowAward,
}

// ── Choosing ────────────────────────────────────────────────────────────────

// Each draws the slide in the look's variant of it, or the classic way. The
// wrapper takes up no room of its own; it only says which one it is.
function Variant({ variants, kind, Classic, props }) {
  const name = variantOf(props.look, kind)
  const Drawn = variants[name] || Classic
  return (
    <div className="contents" data-variant={variants[name] ? name : 'classic'}>
      <Drawn {...props} />
    </div>
  )
}

export const StyledPhoto = (props) => <Variant variants={PHOTOS} kind="photo" Classic={PhotoSlide} props={props} />
export const StyledCount = (props) => <Variant variants={COUNTS} kind="count" Classic={CountSlide} props={props} />
export const StyledThemes = (props) => <Variant variants={THEMES} kind="themes" Classic={ThemesSlide} props={props} />
export const StyledAwardIntro = (props) => <Variant variants={AWARD_INTROS} kind="awardIntro" Classic={AwardIntroSlide} props={props} />
export const StyledAward = (props) => <Variant variants={AWARDS} kind="award" Classic={AwardSlide} props={props} />
