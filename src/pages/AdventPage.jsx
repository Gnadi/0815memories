import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAdventCalendar } from '../hooks/useAdvent'
import AdventDoor from '../components/advent/AdventDoor'
import AdventDoorSheet from '../components/advent/AdventDoorSheet'
import AdventFinale from '../components/advent/AdventFinale'
import AdventScene from '../components/advent/AdventScene'
import MomentViewer from '../components/home/MomentViewer'
import { ADVENT_DOORS, daysUntilAdvent, doorOpensAt, isDoorOpenable } from '../utils/advent'
import '../components/advent/advent.css'

// How long the door takes to swing open before what is behind it comes up.
const SWING_MS = 750

export default function AdventPage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('advent')
  const { familyId, encryptionKey, isAdmin } = useAuth()
  const [now] = useState(() => new Date())
  const { year, doors, layout, opened, open, loading, error } = useAdventCalendar(familyId, encryptionKey, now)
  const [shownDay, setShownDay] = useState(null)
  const [viewingMoment, setViewingMoment] = useState(null)
  const [notice, setNotice] = useState(null)
  const [celebrating, setCelebrating] = useState(false)
  // Set when the last closed door is opened: the finale follows once its
  // sheet is closed, rather than on top of it.
  const finalePending = useRef(false)
  const timers = useRef([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // The page is one screen high, less whatever sits above it — the demo's
  // banner, which wraps to two lines on a phone — so that nothing scrolls.
  const pageRef = useRef(null)
  const [top, setTop] = useState(0)
  useEffect(() => {
    const measure = () => setTop(pageRef.current?.getBoundingClientRect().top + window.scrollY || 0)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const formatDate = useCallback(
    (date, options = { day: 'numeric', month: 'long', year: 'numeric' }) => date.toLocaleDateString(i18n.language, options),
    [i18n.language],
  )

  const byDay = useMemo(() => new Map(doors.map((door) => [door.day, door])), [doors])
  const today = now.getFullYear() === year && now.getMonth() === 11 ? now.getDate() : null
  const countdown = daysUntilAdvent(now)
  const hasEntries = doors.some((door) => door.entry)
  const openedCount = opened.size
  // One line under the title, so the board keeps the rest of the screen: the
  // countdown before the first door, a note when there is nothing to show
  // yet, and otherwise what the calendar is.
  const headline = countdown > 0
    ? t('countdown', { count: countdown })
    : !loading && !error && !hasEntries ? t('empty')
      : openedCount === ADVENT_DOORS ? t('allOpen') : t('subtitle')

  const handleOpen = useCallback((door) => {
    if (!opened.has(door.day) && opened.size === ADVENT_DOORS - 1) finalePending.current = true
    open(door.day)
    timers.current.push(setTimeout(() => setShownDay(door.day), SWING_MS))
  }, [open, opened])

  const handleSheetClose = useCallback(() => {
    setShownDay(null)
    if (finalePending.current) {
      finalePending.current = false
      setCelebrating(true)
    }
  }, [])

  const handleLocked = useCallback((door) => {
    setNotice(t('lockedToast', { day: door.day, date: formatDate(doorOpensAt(year, door.day), { day: 'numeric', month: 'long' }) }))
    timers.current.push(setTimeout(() => setNotice(null), 2500))
  }, [t, formatDate, year])

  const handleShow = useCallback((door) => setShownDay(door.day), [])

  const handleOpenEntry = (entry) => {
    if (entry.type === 'moment') {
      setViewingMoment(entry.doc)
      return
    }
    // In place of the sheet's own history entry, so that back from the memory
    // comes back to the calendar rather than to a sheet that is gone.
    navigate(`/memory/${entry.id}`, { replace: true })
  }

  // Room for the admins' tab bar on a phone; nobody else has one.
  const bottomRoom = isAdmin ? 'pb-[5.25rem] lg:pb-6' : 'pb-[max(1rem,env(safe-area-inset-bottom))] lg:pb-6'

  return (
    <div ref={pageRef} className={`advent-page bg-cream flex flex-col ${bottomRoom}`} style={{ '--advent-top': `${top}px` }}>
      <header className="shrink-0 px-3 sm:px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 flex items-center gap-2 sm:gap-3 max-w-5xl w-full mx-auto">
        <button
          type="button"
          onClick={() => navigate('/home')}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full hover:bg-cream-dark transition-colors"
          aria-label={t('back')}
        >
          <ChevronLeft className="w-5 h-5 text-bark" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="font-serif text-lg sm:text-xl font-bold text-bark truncate">{t('title')} {year}</h1>
            {!loading && !error && countdown === 0 && (
              <span className="shrink-0 text-xs font-semibold text-kaydo-dark tabular-nums">
                {t('progress', { count: openedCount, total: ADVENT_DOORS })}
              </span>
            )}
          </div>
          <p className="text-xs text-bark-light line-clamp-2 [@media(max-height:640px)]:line-clamp-1">{headline}</p>
          {countdown === 0 && (
            <div className="advent-progress mt-1.5" aria-hidden="true">
              <span style={{ width: `${(openedCount / ADVENT_DOORS) * 100}%` }} />
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 min-h-0 w-full max-w-5xl mx-auto px-3 sm:px-4 pt-2 flex flex-col">
        <div className="advent-board advent-board--framed flex-1 min-h-0 flex flex-col rounded-3xl p-3 pt-5 sm:p-5 sm:pt-7 advent-board--scene">
          <span className="advent-lights" aria-hidden="true" />
          <AdventScene className="advent-scene" />
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <p className="flex-1 flex items-center justify-center text-center text-white/90 text-sm">{t('error')}</p>
          ) : (
            <div className="advent-grid-wrap flex-1 min-h-0">
              <div className="advent-grid">
                {layout.map((day) => {
                  const door = byDay.get(day)
                  if (!door) return null
                  return (
                    <AdventDoor
                      key={day}
                      door={door}
                      isOpen={opened.has(day)}
                      openable={isDoorOpenable(year, day, now)}
                      isToday={day === today}
                      dateLabel={formatDate(doorOpensAt(year, day), { day: 'numeric', month: 'long' })}
                      onOpen={handleOpen}
                      onShow={handleShow}
                      onLocked={handleLocked}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {notice && (
        <div role="status" className="fixed bottom-28 lg:bottom-10 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-2rem)] text-center rounded-full bg-bark text-white text-sm px-4 py-2 shadow-lg">
          {notice}
        </div>
      )}

      {shownDay !== null && byDay.get(shownDay) && (
        <AdventDoorSheet
          door={byDay.get(shownDay)}
          year={year}
          formatDate={formatDate}
          onClose={handleSheetClose}
          onOpenEntry={handleOpenEntry}
        />
      )}

      {celebrating && <AdventFinale onClose={() => setCelebrating(false)} />}

      {viewingMoment && (
        <MomentViewer
          moments={[viewingMoment]}
          initialIndex={0}
          onClose={() => setViewingMoment(null)}
          isAdmin={false}
        />
      )}
    </div>
  )
}
