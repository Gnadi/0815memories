import { useTranslation } from 'react-i18next'
import { Gift } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useOpenedDoors } from '../../hooks/useAdvent'
import { ADVENT_DOORS, adventYear, daysUntilAdvent, isAdventSeason } from '../../utils/advent'
import HomeNoticeCard from '../home/HomeNoticeCard'

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
    <HomeNoticeCard
      to="/advent"
      background="advent"
      eyebrow={t('home.eyebrow')}
      title={title}
      body={t('home.body')}
      cta={t('home.cta')}
      icon={day
        ? <span className="font-serif text-2xl font-bold text-kaydo-dark">{day}</span>
        : <Gift className="w-6 h-6 text-kaydo" />}
    />
  )
}
