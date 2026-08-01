import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarHeart, Mail, Plus, Settings2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useOurYearChapters, useOurYearRitual } from '../hooks/useOurYear'
import {
  daysUntilRitual,
  formatDayOfYear,
  letterState,
  occasionLabelFor,
  sortChapters,
} from '../utils/ourYear'
import ChapterTimelineCard from '../components/ouryear/ChapterTimelineCard'
import NewChapterModal from '../components/ouryear/NewChapterModal'
import Sidebar from '../components/layout/Sidebar'
import MobileHeader from '../components/layout/MobileHeader'

/**
 * The heart of "Our Year": every chapter the couple has kept, newest first.
 *
 * Everything here belongs to exactly two people. An admin of the same family
 * who is not one of them sees the invitation to set up their own ritual and
 * nothing else — the security rules make sure that isn't just politeness.
 */
export default function OurYearPage() {
  const { t, i18n } = useTranslation('ourYear')
  const locale = i18n.language || 'de'
  const { isAdmin, familyId, user, encryptionKey } = useAuth()
  const navigate = useNavigate()
  const uid = user?.uid ?? null

  const { ritual, loading: ritualLoading } = useOurYearRitual(familyId, uid, encryptionKey)
  const { chapters, loading: chaptersLoading, addChapter } = useOurYearChapters(
    ritual?.id ?? null,
    uid,
    encryptionKey,
  )
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!isAdmin) navigate('/home')
  }, [isAdmin, navigate])

  if (!isAdmin) return null

  const loading = ritualLoading || (ritual && chaptersLoading)
  const sorted = sortChapters(chapters)
  const waitingLetter = sorted.find((c) => letterState(c) === 'waiting')
  const daysUntil = daysUntilRitual(ritual)

  const handleCreate = async (data) => {
    const id = await addChapter(ritual, data)
    setCreating(false)
    navigate(`/our-year/${id}`)
  }

  return (
    <div className="min-h-screen bg-cream flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-20 lg:pb-0">
        <MobileHeader />

        <main className="flex-1 px-4 lg:px-8 py-6 max-w-2xl mx-auto w-full">
          <header className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <CalendarHeart className="w-5 h-5 text-kaydo" />
              <span className="text-xs font-semibold text-kaydo tracking-widest uppercase">
                {t('page.eyebrow')}
              </span>
            </div>
            <h1 className="font-serif text-3xl font-bold text-bark leading-tight">
              {t('page.title')}
            </h1>
            <p className="text-bark-light mt-1 text-sm max-w-lg">{t('page.subtitle')}</p>
          </header>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-kaydo border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !ritual ? (
            <NoRitual onSetup={() => navigate('/our-year/setup')} />
          ) : (
            <>
              {/* The couple's rhythm — orientation, never a gate. */}
              <section className="bg-warm-white rounded-2xl p-4 shadow-sm mb-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-bark">
                      {occasionLabelFor(ritual, t)}
                    </p>
                    <p className="text-sm text-bark-muted mt-0.5">
                      {ritual.rhythm === 'recurring'
                        ? t('ritual.onDate', {
                            date: formatDayOfYear(ritual.anchorMonth, ritual.anchorDay, locale),
                          })
                        : t('ritual.noFixedDate')}
                    </p>
                    {ritual.rhythm === 'recurring' && daysUntil !== null && (
                      <p className="text-xs text-bark-muted mt-1">
                        {daysUntil === 0
                          ? t('ritual.nextToday')
                          : t('ritual.nextIn', { count: daysUntil })}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/our-year/setup')}
                    className="flex items-center gap-1.5 text-sm text-kaydo font-semibold hover:underline flex-shrink-0"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    {t('ritual.edit')}
                  </button>
                </div>
                <p className="text-xs text-bark-muted mt-3 pt-3 border-t border-cream-dark">
                  {t('ritual.flexNote')}
                </p>
              </section>

              {waitingLetter && (
                <button
                  type="button"
                  onClick={() => navigate(`/our-year/${waitingLetter.id}`)}
                  className="w-full text-left bg-warm-white border border-kaydo/30 rounded-2xl p-5 mb-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-kaydo/10 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5 text-kaydo" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-serif text-lg font-bold text-bark leading-snug">
                        {t('letter.waitingHeading')}
                      </p>
                      <p className="text-sm text-bark-muted mt-0.5">
                        {t('nudge.letterWaiting.body', { chapter: waitingLetter.title })}
                      </p>
                    </div>
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => setCreating(true)}
                className="btn-kaydo w-full flex items-center justify-center gap-2 text-sm mb-6"
              >
                <Plus className="w-4 h-4" />
                {t('page.newChapter')}
              </button>

              {sorted.length === 0 ? (
                <EmptyTimeline onCreate={() => setCreating(true)} />
              ) : (
                <>
                  <div className="flex items-baseline justify-between mb-3">
                    <h2 className="text-sm font-semibold text-bark">{t('page.timelineHeading')}</h2>
                    <span className="text-xs text-bark-muted">
                      {t('page.chapterCount', { count: sorted.length })}
                    </span>
                  </div>

                  <ol className="relative border-l border-cream-dark ml-2 pl-5 space-y-5">
                    {sorted.map((chapter) => (
                      <li key={chapter.id} className="relative">
                        <span
                          aria-hidden="true"
                          className={`absolute -left-[27px] top-6 w-2.5 h-2.5 rounded-full ring-4 ring-cream ${
                            chapter.status === 'closed' ? 'bg-bark-muted' : 'bg-kaydo'
                          }`}
                        />
                        <ChapterTimelineCard
                          chapter={chapter}
                          onOpen={() => navigate(`/our-year/${chapter.id}`)}
                        />
                      </li>
                    ))}
                  </ol>
                </>
              )}

              <p className="text-xs text-bark-muted mt-8">{t('privacy.note')}</p>
            </>
          )}
        </main>
      </div>

      {creating && ritual && (
        <NewChapterModal
          ritual={ritual}
          chapters={chapters}
          onClose={() => setCreating(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}

function NoRitual({ onSetup }) {
  const { t } = useTranslation('ourYear')
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-cream-dark flex items-center justify-center">
        <CalendarHeart className="w-8 h-8 text-bark-muted" />
      </div>
      <div className="max-w-md">
        <p className="font-serif text-lg font-semibold text-bark mb-1">{t('gate.heading')}</p>
        <p className="text-sm text-bark-muted">{t('gate.body')}</p>
      </div>
      <button
        type="button"
        onClick={onSetup}
        className="flex items-center gap-2 bg-bark text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-bark/90 transition-colors"
      >
        {t('gate.cta')}
      </button>
    </div>
  )
}

function EmptyTimeline({ onCreate }) {
  const { t } = useTranslation('ourYear')
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-cream-dark flex items-center justify-center">
        <CalendarHeart className="w-8 h-8 text-bark-muted" />
      </div>
      <div className="max-w-md">
        <p className="font-serif text-lg font-semibold text-bark mb-1">{t('empty.heading')}</p>
        <p className="text-sm text-bark-muted">{t('empty.body')}</p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="flex items-center gap-2 bg-bark text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-bark/90 transition-colors"
      >
        <Plus className="w-4 h-4" />
        {t('empty.cta')}
      </button>
    </div>
  )
}
