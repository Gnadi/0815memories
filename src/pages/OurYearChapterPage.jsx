import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { serverTimestamp } from 'firebase/firestore'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  useOurYearChapter,
  useOurYearChapters,
  useOurYearRitual,
} from '../hooks/useOurYear'
import {
  formatDay,
  formatPeriod,
  participantName,
  partnerUidOf,
} from '../utils/ourYear'
import ChapterStageRail from '../components/ouryear/ChapterStageRail'
import ChapterSummary from '../components/ouryear/ChapterSummary'
import KeepsakesSection from '../components/ouryear/KeepsakesSection'
import LetterSection from '../components/ouryear/LetterSection'
import QuizSection from '../components/ouryear/QuizSection'
import ReflectionSection from '../components/ouryear/ReflectionSection'
import Sidebar from '../components/layout/Sidebar'
import MobileHeader from '../components/layout/MobileHeader'

const STEPS = ['reflection', 'quiz', 'letter', 'keepsakes', 'summary']

/**
 * One chapter, from both sides.
 *
 * Not a wizard: the couple can move between the review, the quiz, the letter
 * and the keepsakes in whatever order they like, over as many sittings as they
 * like. A closed chapter renders the same parts, read-only.
 */
export default function OurYearChapterPage() {
  const { t, i18n } = useTranslation('ourYear')
  const locale = i18n.language || 'de'
  const { chapterId } = useParams()
  const navigate = useNavigate()
  const { isAdmin, familyId, user, encryptionKey } = useAuth()
  const uid = user?.uid ?? null

  const { ritual } = useOurYearRitual(familyId, uid, encryptionKey)
  const { chapter, loading, missing, updateChapter } = useOurYearChapter(chapterId, encryptionKey)
  const { deleteChapter } = useOurYearChapters(null, encryptionKey)

  const [step, setStep] = useState('reflection')
  const sectionRefs = useRef({})

  useEffect(() => {
    if (!isAdmin) navigate('/home')
  }, [isAdmin, navigate])

  if (!isAdmin) return null

  const readOnly = chapter?.status === 'closed'
  const partnerLabel =
    participantName(ritual, partnerUidOf(chapter ?? ritual, uid)) || t('partner.genericShort')

  const goToStep = (next) => {
    setStep(next)
    sectionRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleDelete = async () => {
    if (!window.confirm(t('chapter.deleteConfirm'))) return
    await deleteChapter(chapter)
    navigate('/our-year')
  }

  const handleClose = async () => {
    await updateChapter({ status: 'closed', closedAt: serverTimestamp() })
    setStep('summary')
  }

  return (
    <div className="min-h-screen bg-cream flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-20 lg:pb-0">
        <MobileHeader />

        <main className="flex-1 px-4 lg:px-8 py-6 max-w-2xl mx-auto w-full">
          <button
            type="button"
            onClick={() => navigate('/our-year')}
            className="flex items-center gap-1.5 text-sm text-bark-muted hover:text-bark transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('chapter.backToTimeline')}
          </button>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-kaydo border-t-transparent rounded-full animate-spin" />
            </div>
          ) : missing || !chapter ? (
            <p className="text-sm text-bark-muted py-16 text-center">{t('chapter.notFound')}</p>
          ) : (
            <>
              <header className="mb-5">
                <h1 className="font-serif text-3xl font-bold text-bark leading-tight break-words">
                  {chapter.title}
                </h1>
                <p className="text-sm text-bark-muted mt-1">
                  {formatPeriod(chapter.periodStart, chapter.periodEnd, locale)}
                </p>
                {readOnly && (
                  <p className="text-xs text-bark-muted mt-2 bg-cream-dark rounded-xl px-3 py-2 inline-block">
                    {t('chapter.closedNote', { date: formatDay(chapter.closedAt, locale) })}
                  </p>
                )}
              </header>

              {!readOnly && (
                <div className="mb-6">
                  <ChapterStageRail
                    chapter={chapter}
                    uid={uid}
                    partnerName={partnerLabel}
                    activeStep={step}
                    onSelect={goToStep}
                  />
                </div>
              )}

              <div className="space-y-5">
                {STEPS.map((id) => (
                  <div
                    key={id}
                    ref={(el) => {
                      sectionRefs.current[id] = el
                    }}
                    className="scroll-mt-4"
                  >
                    {id === 'reflection' && (
                      <ReflectionSection
                        chapter={chapter}
                        ritual={ritual}
                        uid={uid}
                        encryptionKey={encryptionKey}
                        readOnly={readOnly}
                      />
                    )}
                    {id === 'quiz' && (
                      <QuizSection
                        chapter={chapter}
                        ritual={ritual}
                        uid={uid}
                        encryptionKey={encryptionKey}
                        readOnly={readOnly}
                        onUpdateChapter={updateChapter}
                      />
                    )}
                    {id === 'letter' && (
                      <LetterSection
                        chapter={chapter}
                        ritual={ritual}
                        encryptionKey={encryptionKey}
                        readOnly={readOnly}
                      />
                    )}
                    {id === 'keepsakes' && (
                      <KeepsakesSection
                        chapter={chapter}
                        encryptionKey={encryptionKey}
                        readOnly={readOnly}
                        onUpdateChapter={updateChapter}
                      />
                    )}
                    {id === 'summary' && (
                      <ChapterSummary chapter={chapter} onClose={handleClose} />
                    )}
                  </div>
                ))}
              </div>

              {readOnly ? (
                <p className="text-xs text-bark-muted mt-8">{t('chapter.readOnly')}</p>
              ) : (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="mt-8 flex items-center gap-2 text-sm text-bark-muted hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('chapter.delete')}
                </button>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
