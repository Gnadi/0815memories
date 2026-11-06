import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Gift } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useOpenedDoors } from '../../hooks/useAdvent'
import { ADVENT_DOORS, adventYear, daysUntilAdvent, isAdventSeason } from '../../utils/advent'
import './advent.css'

/**
 * The advent calendar on the home page, from a week before the first door to
 * Epiphany: a countdown, today's door, or — after Christmas — all of them. It
 * reads nothing from Firestore; the calendar page does that when it is opened.
 */
export default function AdventHomeCard({ now = new Date() }) {
  const { familyId } = useAuth()
  const { t } = useTranslation('advent')
  const year = adventYear(now)
  const { opened } = useOpenedDoors(familyId, year)

  if (!isAdventSeason(now)) return null

  const countdown = daysUntilAdvent(now)
  // Today's door, from the 1st to the 24th; after that, all of them are open.
  const day = now.getMonth() === 11 && now.getDate() <= ADVENT_DOORS ? now.getDate() : null
  const title = countdown > 0
    ? t('home.teaserTitle', { count: countdown })
    : day
      ? t(opened.has(day) ? 'home.openedTitle' : 'home.todayTitle', { day })
      : t('home.afterTitle')

  return (
    <Link to="/advent" className="block mb-6 rounded-2xl overflow-hidden group advent-board shadow-md">
      <div className="flex items-center gap-4 px-5 py-5">
        <div className="w-12 h-12 rounded-xl bg-warm-white flex items-center justify-center flex-shrink-0 shadow">
          {day
            ? <span className="font-serif text-2xl font-bold text-kaydo-dark">{day}</span>
            : <Gift className="w-6 h-6 text-kaydo" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-widest text-white/75 uppercase mb-1">{t('home.eyebrow')}</p>
          <p className="font-serif text-lg font-bold text-white leading-snug">{title}</p>
          <p className="text-sm text-white/80 mt-0.5">{t('home.body')}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 group-hover:bg-white/30 transition-colors">
          <ChevronRight className="w-5 h-5 text-white" aria-hidden="true" />
          <span className="sr-only">{t('home.cta')}</span>
        </div>
      </div>
    </Link>
  )
}
