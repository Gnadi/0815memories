import { useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { useDateFormat } from '../../hooks/useDateFormat'
import EncryptedImage from '../media/EncryptedImage'
import { thumbAt, tinyPreviewAt } from '../../utils/mediaThumbs'

// The featured memory shares a swipeable strip with the Smart Timeline, so the
// timeline is one swipe away instead of at the bottom of an ever-growing feed.
// Native scroll-snap does the swiping on touch. A mouse cannot swipe a scroll
// container, so on desktop the strip can be dragged, and arrows and dots page it.
// On a phone each slide is a little narrower than the strip, so the edge of the
// other one peeks in and shows there is something to swipe to.
const SLIDE_COUNT = 2
const PREVIEW_COUNT = 3
// How far a mouse drag must travel to count as a swipe rather than a click.
const CLICK_SLOP = 6
const SWIPE_DISTANCE = 60

export default function FeaturedJourney({ memory, memories = [] }) {
  const { t } = useTranslation('home')
  const trackRef = useRef(null)
  const [active, setActive] = useState(0)
  const [dragging, setDragging] = useState(false)
  const drag = useRef(null)
  const suppressClick = useRef(false)

  const handleScroll = () => {
    const el = trackRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    if (max <= 0) return
    setActive(el.scrollLeft > max / 2 ? 1 : 0)
  }

  const goTo = (index) => {
    const el = trackRef.current
    if (!el) return
    el.scrollTo?.({ left: index === 0 ? 0 : el.scrollWidth, behavior: 'smooth' })
    setActive(index)
  }

  // Mouse only: touch and pen already scroll the strip natively. Snapping is
  // off while dragging, or the browser would fight every pixel of the drag.
  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const el = trackRef.current
    if (!el) return
    drag.current = { x: e.clientX, scrollLeft: el.scrollLeft, from: active, moved: false }
    suppressClick.current = false
  }

  const onPointerMove = (e) => {
    const d = drag.current
    const el = trackRef.current
    if (!d || !el) return
    const dx = e.clientX - d.x
    if (!d.moved && Math.abs(dx) < CLICK_SLOP) return
    if (!d.moved) {
      d.moved = true
      setDragging(true)
      el.setPointerCapture?.(e.pointerId)
    }
    el.scrollLeft = d.scrollLeft - dx
  }

  const onPointerUp = (e) => {
    const d = drag.current
    drag.current = null
    if (!d?.moved) return
    // The click that ends a drag must not open the slide under the mouse.
    suppressClick.current = true
    setDragging(false)
    const dx = e.clientX - d.x
    if (dx <= -SWIPE_DISTANCE) goTo(Math.min(d.from + 1, SLIDE_COUNT - 1))
    else if (dx >= SWIPE_DISTANCE) goTo(Math.max(d.from - 1, 0))
    else goTo(d.from)
  }

  const onClickCapture = (e) => {
    if (!suppressClick.current) return
    suppressClick.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <section className="mb-8">
      <div className="relative group/featured">
        <div
          ref={trackRef}
          onScroll={handleScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClickCapture={onClickCapture}
          onDragStart={(e) => e.preventDefault()}
          className={`flex gap-3 lg:gap-4 overflow-x-auto hide-scrollbar ${
            dragging ? 'snap-none select-none cursor-grabbing' : 'snap-x snap-mandatory'
          }`}
        >
          <div className="w-[88%] lg:w-full flex-shrink-0 snap-start">
            {memory ? <FeaturedSlide memory={memory} /> : <FeaturedPlaceholder />}
          </div>
          <div className="w-[88%] lg:w-full flex-shrink-0 snap-end">
            <TimelineSlide memories={memories} />
          </div>
        </div>

        {/* Desktop only: on a phone the swipe and the peeking edge are enough. */}
        {active > 0 && (
          <SlideArrow side="left" label={t('featured.previous')} onClick={() => goTo(active - 1)} />
        )}
        {active < SLIDE_COUNT - 1 && (
          <SlideArrow side="right" label={t('featured.next')} onClick={() => goTo(active + 1)} />
        )}
      </div>

      <div className="flex justify-center gap-2 mt-3">
        {Array.from({ length: SLIDE_COUNT }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            aria-label={t('featured.goToSlide', { n: i + 1, total: SLIDE_COUNT })}
            aria-current={active === i}
            className={`h-2 rounded-full transition-all ${
              active === i ? 'w-5 bg-kaydo' : 'w-2 bg-cream-dark hover:bg-bark-muted'
            }`}
          />
        ))}
      </div>
    </section>
  )
}

function SlideArrow({ side, label, onClick }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`hidden lg:flex absolute top-1/2 -translate-y-1/2 ${
        side === 'left' ? 'left-3' : 'right-3'
      } z-10 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-bark shadow-md items-center justify-center opacity-0 group-hover/featured:opacity-100 focus-visible:opacity-100 transition-opacity`}
    >
      <Icon className="w-5 h-5" />
    </button>
  )
}

function FeaturedSlide({ memory }) {
  const navigate = useNavigate()
  const { t } = useTranslation('home')
  const { timeAgo } = useDateFormat()

  return (
    <div
      className="relative rounded-2xl overflow-hidden h-80 lg:h-[480px] cursor-pointer group"
      onClick={() => navigate(`/memory/${memory.id}`)}
    >
      {memory.imageUrl ? (
        <EncryptedImage
          src={memory.imageUrl}
          alt={memory.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      ) : (
        <FeaturedPlaceholderImage />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="absolute bottom-6 left-6 right-6 text-white">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-kaydo text-white text-xs font-bold px-3 py-1 rounded-full uppercase">
            {memory.category || t('featured.badge')}
          </span>
          <span className="text-sm opacity-80">{timeAgo(memory.createdAt)}</span>
        </div>
        <h3 className="text-2xl lg:text-3xl font-bold font-serif mb-1">{memory.title}</h3>
        <p className="text-sm opacity-90 line-clamp-2">{memory.content}</p>
      </div>
    </div>
  )
}

const yearOf = (date) => {
  if (!date) return null
  const d = date.toDate ? date.toDate() : new Date(date)
  return Number.isNaN(d.getTime()) ? null : d.getFullYear()
}

// A few photos for the timeline slide, one per year where the feed reaches that
// far back, so the preview already hints at travelling through time.
function pickPreviews(memories) {
  const withPhoto = memories.filter((m) => m.images?.length || m.imageUrl)
  const picks = []
  const years = new Set()
  for (const m of withPhoto) {
    const year = yearOf(m.date || m.createdAt)
    if (years.has(year)) continue
    years.add(year)
    picks.push(m)
    if (picks.length === PREVIEW_COUNT) return picks
  }
  for (const m of withPhoto) {
    if (picks.length === PREVIEW_COUNT) break
    if (!picks.includes(m)) picks.push(m)
  }
  return picks
}

// Fanned polaroids: the newest in front, older ones tilted out behind it.
const FAN = [
  'rotate-[-3deg] z-30',
  'rotate-[8deg] translate-x-16 -translate-y-2 z-20',
  'rotate-[-12deg] -translate-x-16 -translate-y-1 z-10',
]

function TimelineSlide({ memories }) {
  const { t } = useTranslation('home')
  const previews = pickPreviews(memories)

  return (
    <Link
      to="/timeline"
      className="relative flex flex-col justify-end rounded-2xl overflow-hidden h-80 lg:h-[480px] p-6 group"
      style={{ background: 'linear-gradient(135deg, #A04420 0%, #C25A2E 60%, #D4784A 100%)' }}
    >
      {previews.length > 0 ? (
        // In the flow rather than absolute, so the photos take only the room the
        // text leaves them and shrink when a long title wraps.
        <div className="flex-1 min-h-0 flex items-center justify-center pt-1 pb-6 lg:pb-10" aria-hidden="true">
          <div className="relative h-full max-h-32 lg:max-h-48 aspect-[7/8]">
            {previews.map((m, i) => (
              <div
                key={m.id}
                className={`absolute inset-0 bg-white p-1.5 pb-5 lg:p-2 lg:pb-7 rounded-sm shadow-lg transition-transform duration-500 group-hover:scale-105 ${FAN[i]}`}
              >
                <EncryptedImage
                  src={m.images?.[0] || m.imageUrl}
                  thumbSrc={thumbAt(m, 0)}
                  tinyPreview={tinyPreviewAt(m, 0)}
                  alt=""
                  className="w-full h-full object-cover bg-cream-dark"
                />
                {yearOf(m.date || m.createdAt) && (
                  <span className="absolute bottom-0.5 lg:bottom-1.5 inset-x-0 text-center text-[10px] lg:text-xs font-semibold text-bark-muted">
                    {yearOf(m.date || m.createdAt)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Clock
          className="absolute -top-6 -right-6 w-48 h-48 lg:w-64 lg:h-64 text-white/10"
          strokeWidth={1.2}
          aria-hidden="true"
        />
      )}
      <p className="relative text-xs font-semibold tracking-widest text-white/70 uppercase mb-2">{t('timelineCta.eyebrow')}</p>
      <div className="relative flex items-end justify-between gap-4">
        <div>
          <h3 className="text-2xl lg:text-3xl font-bold font-serif text-white mb-1">{t('timelineCta.title')}</h3>
          <p className="text-sm text-white/85 leading-relaxed max-w-xs">{t('timelineCta.body')}</p>
        </div>
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  )
}

function FeaturedPlaceholder() {
  const { t } = useTranslation('home')
  return (
    <div className="relative rounded-2xl overflow-hidden h-80 lg:h-[480px]">
      <FeaturedPlaceholderImage />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="absolute bottom-6 left-6 right-6 text-white">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-kaydo text-white text-xs font-bold px-3 py-1 rounded-full uppercase">
            {t('featured.badge')}
          </span>
          <span className="text-sm opacity-80">{t('featured.awaiting')}</span>
        </div>
        <h3 className="text-2xl lg:text-3xl font-bold font-serif mb-1">
          {t('featured.placeholderTitle')}
        </h3>
        <p className="text-sm opacity-90">
          {t('featured.placeholderBody')}
        </p>
      </div>
    </div>
  )
}

function FeaturedPlaceholderImage() {
  return (
    <svg viewBox="0 0 800 400" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="featSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#87CEEB" />
          <stop offset="50%" stopColor="#E8A87C" />
          <stop offset="100%" stopColor="#D4A574" />
        </linearGradient>
      </defs>
      <rect width="800" height="400" fill="url(#featSky)" />
      {/* Mountains */}
      <path d="M0,300 L150,150 L300,280 L450,120 L600,250 L750,160 L800,200 L800,400 L0,400Z" fill="#5B7553" opacity="0.6" />
      <path d="M0,350 L200,220 L400,320 L600,200 L800,300 L800,400 L0,400Z" fill="#4A6741" opacity="0.7" />
      {/* Water */}
      <rect x="0" y="340" width="800" height="60" fill="#4A90A4" opacity="0.5" />
      {/* Sun */}
      <circle cx="650" cy="120" r="40" fill="#FFD700" opacity="0.6" />
      {/* Family silhouettes */}
      <g transform="translate(300, 240)">
        <circle cx="0" cy="-25" r="12" fill="#8B4513" />
        <ellipse cx="0" cy="5" rx="14" ry="22" fill="#A0522D" />
        <circle cx="40" cy="-20" r="10" fill="#CD853F" />
        <ellipse cx="40" cy="8" rx="12" ry="20" fill="#D2691E" />
        <circle cx="-35" cy="-22" r="11" fill="#DEB887" />
        <ellipse cx="-35" cy="6" rx="13" ry="21" fill="#D2B48C" />
        <circle cx="15" cy="-5" r="8" fill="#F4A460" />
        <ellipse cx="15" cy="16" rx="9" ry="15" fill="#DEB887" />
      </g>
    </svg>
  )
}
