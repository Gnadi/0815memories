import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAdventCalendar } from '../hooks/useAdvent'
import AdventDoor from '../components/advent/AdventDoor'
import AdventDoorSheet from '../components/advent/AdventDoorSheet'
import MomentViewer from '../components/home/MomentViewer'
import { daysUntilAdvent, doorOpensAt, isDoorOpenable } from '../utils/advent'
import '../components/advent/advent.css'

// How long the door takes to swing open before what is behind it comes up.
const SWING_MS = 750

export default function AdventPage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('advent')
  const { familyId, encryptionKey } = useAuth()
  const [now] = useState(() => new Date())
  const { year, doors, layout, opened, open, loading, error } = useAdventCalendar(familyId, encryptionKey, now)
  const [shownDay, setShownDay] = useState(null)
  const [viewingMoment, setViewingMoment] = useState(null)
  const [notice, setNotice] = useState(null)
  const timers = useRef([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const formatDate = useCallback(
    (date, options = { day: 'numeric', month: 'long', year: 'numeric' }) => date.toLocaleDateString(i18n.language, options),
    [i18n.language],
  )

  const byDay = useMemo(() => new Map(doors.map((door) => [door.day, door])), [doors])
  const today = now.getFullYear() === year && now.getMonth() === 11 ? now.getDate() : null
  const countdown = daysUntilAdvent(now)
  const hasEntries = doors.some((door) => door.entry)

  const handleOpen = useCallback((door) => {
    open(door.day)
    timers.current.push(setTimeout(() => setShownDay(door.day), SWING_MS))
  }, [open])

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

  return (
    <div className="min-h-screen bg-cream pb-24 lg:pb-8">
      <div className="sticky top-0 z-10 bg-cream border-b border-cream-dark px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/home')}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-cream-dark transition-colors"
          aria-label={t('back')}
        >
          <ChevronLeft className="w-5 h-5 text-bark" />
        </button>
        <h1 className="text-lg font-bold text-bark">{t('title')} {year}</h1>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-5">
        <p className="text-sm text-bark-light mb-4">{t('subtitle')}</p>
        {countdown > 0 && (
          <p className="mb-4 rounded-2xl bg-warm-white border border-cream-dark px-4 py-3 text-sm font-semibold text-kaydo-dark">
            {t('countdown', { count: countdown })}
          </p>
        )}

        <div className="advent-board rounded-3xl p-4 sm:p-6 shadow-lg">
          {loading ? (
            <div className="py-24 flex justify-center">
              <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <p className="py-16 text-center text-white/90 text-sm">{t('error')}</p>
          ) : (
            <>
              {!hasEntries && <p className="mb-4 text-center text-white/90 text-sm">{t('empty')}</p>}
              <div className="advent-grid-wrap">
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
            </>
          )}
        </div>
      </main>

      {notice && (
        <div role="status" className="fixed bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 z-40 rounded-full bg-bark text-white text-sm px-4 py-2 shadow-lg">
          {notice}
        </div>
      )}

      {shownDay !== null && byDay.get(shownDay) && (
        <AdventDoorSheet
          door={byDay.get(shownDay)}
          year={year}
          formatDate={formatDate}
          onClose={() => setShownDay(null)}
          onOpenEntry={handleOpenEntry}
        />
      )}

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
