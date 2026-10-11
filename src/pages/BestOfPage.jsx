import { useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, Sparkles, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { markBestOfSeen, useBestOfMonth } from '../hooks/useBestOf'
import { isMonthKey } from '../utils/bestOf'
import { bestOfLabels } from '../components/bestof/bestOfLabels'
import BestOfViewer from '../components/bestof/BestOfViewer'

/**
 * /best-of/<YYYY-MM> — where the push on the 1st leads, and where the moments
 * row's circle opens. Plays the month's saved best-of, or puts it together
 * first, here and now, when nobody has yet (hooks/useBestOf.js).
 */
export default function BestOfPage() {
  const { month } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { t, i18n } = useTranslation('bestOf')
  const { familyId, encryptionKey, isAdmin } = useAuth()

  const valid = isMonthKey(month)
  const { status, bestOf, retry, remake } = useBestOfMonth({
    familyId,
    encryptionKey,
    isAdmin,
    month: valid ? month : null,
  })

  useEffect(() => {
    if (status === 'ready' && familyId) markBestOfSeen(familyId, month)
  }, [status, familyId, month])

  // Back where it was opened from; to the home page when it was opened from
  // outside — a notification starts a history of its own.
  const close = () => {
    if (location.key !== 'default') navigate(-1)
    else navigate('/home', { replace: true })
  }

  if (valid && status === 'ready' && bestOf) {
    return <BestOfViewer bestOf={bestOf} onClose={close} onRemake={isAdmin ? remake : undefined} />
  }

  const labels = valid ? bestOfLabels(month, i18n.language, t) : null

  return (
    <div className="fixed inset-0 z-50 bg-[#141a2e] text-white flex flex-col items-center justify-center px-8 text-center">
      <button
        type="button"
        onClick={close}
        className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-3 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
        aria-label={t('controls.close')}
      >
        <X className="w-5 h-5" />
      </button>

      {!valid ? (
        <p className="text-lg">{t('making.notFound')}</p>
      ) : status === 'empty' ? (
        <>
          <Sparkles className="w-10 h-10 text-white/60 mb-4" aria-hidden="true" />
          <p className="text-lg max-w-xs">{t('making.empty', { month: labels.monthName })}</p>
          <button type="button" onClick={close} className="mt-6 rounded-full bg-warm-white text-bark px-6 py-2.5 text-sm font-semibold">
            {t('making.back')}
          </button>
        </>
      ) : status === 'error' ? (
        <>
          <p className="text-lg max-w-xs">{t('making.error')}</p>
          <button type="button" onClick={retry} className="mt-6 rounded-full bg-warm-white text-bark px-6 py-2.5 text-sm font-semibold">
            {t('making.retry')}
          </button>
        </>
      ) : status === 'making' ? (
        <div className="max-w-xs" role="status">
          <Sparkles className="w-12 h-12 mx-auto mb-6 text-amber-300 animate-pulse" aria-hidden="true" />
          <p className="text-2xl font-semibold leading-snug">{t('making.title', { month: labels.monthName })}</p>
          <p className="mt-3 text-sm text-white/70 leading-relaxed">{t('making.body')}</p>
          <Loader2 className="w-6 h-6 mx-auto mt-8 animate-spin text-white/60" aria-hidden="true" />
        </div>
      ) : (
        <Loader2 className="w-8 h-8 animate-spin text-white/70" aria-label={labels.title} />
      )}
    </div>
  )
}
