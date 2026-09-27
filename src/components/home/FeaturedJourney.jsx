import { useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'
import { timeAgo } from '../../utils/helpers'
import EncryptedImage from '../media/EncryptedImage'

// The featured memory shares a swipeable strip with the Smart Timeline, so the
// timeline is one swipe away instead of at the bottom of an ever-growing feed.
// Native scroll-snap does the swiping; the dots are for mouse and keyboard.
const SLIDE_COUNT = 2

export default function FeaturedJourney({ memory }) {
  const { t } = useTranslation('home')
  const trackRef = useRef(null)
  const [active, setActive] = useState(0)

  const handleScroll = () => {
    const el = trackRef.current
    if (!el || !el.clientWidth) return
    setActive(Math.round(el.scrollLeft / el.clientWidth))
  }

  const goTo = (index) => {
    const el = trackRef.current
    if (!el) return
    el.scrollTo?.({ left: index * el.clientWidth, behavior: 'smooth' })
    setActive(index)
  }

  return (
    <section className="mb-8">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar rounded-2xl"
      >
        <div className="w-full flex-shrink-0 snap-center">
          {memory ? <FeaturedSlide memory={memory} /> : <FeaturedPlaceholder />}
        </div>
        <div className="w-full flex-shrink-0 snap-center">
          <TimelineSlide />
        </div>
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

function FeaturedSlide({ memory }) {
  const navigate = useNavigate()
  const { t } = useTranslation('home')

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

function TimelineSlide() {
  const { t } = useTranslation('home')
  return (
    <Link
      to="/timeline"
      className="relative flex flex-col justify-end rounded-2xl overflow-hidden h-80 lg:h-[480px] p-6 group"
      style={{ background: 'linear-gradient(135deg, #A04420 0%, #C25A2E 60%, #D4784A 100%)' }}
    >
      <Clock
        className="absolute -top-6 -right-6 w-48 h-48 lg:w-64 lg:h-64 text-white/10"
        strokeWidth={1.2}
        aria-hidden="true"
      />
      <p className="text-xs font-semibold tracking-widest text-white/70 uppercase mb-2">{t('timelineCta.eyebrow')}</p>
      <div className="flex items-end justify-between gap-4">
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
