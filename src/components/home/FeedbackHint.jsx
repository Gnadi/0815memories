import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquareHeart } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useFeedbackHint } from '../../hooks/useFeedbackHint'
import HomeNoticeCard from './HomeNoticeCard'

// Lazy, as in FeedbackLauncher: the form waits behind a tap most visits never make.
const FeedbackModal = lazy(() => import('../FeedbackModal'))

/**
 * Asks on the home page what the family thinks of Kaydo, and opens the
 * feedback form on a tap (see useFeedbackHint for how long an answer keeps it
 * away).
 */
export default function FeedbackHint() {
  const { t } = useTranslation('home')
  const { isDemo } = useAuth()
  const { show, snooze, thank } = useFeedbackHint()
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)

  // Not in the demo: feedback left there would go nowhere (FeedbackLauncher
  // hides itself there too), and its home page is the landing screenshots'.
  if (isDemo || !show || (sent && !open)) return null

  return (
    <>
      <HomeNoticeCard
        onClick={() => setOpen(true)}
        background="forest"
        eyebrow={t('feedbackHint.eyebrow')}
        title={t('feedbackHint.title')}
        body={t('feedbackHint.body')}
        cta={t('feedbackHint.action')}
        icon={<MessageSquareHeart className="w-6 h-6 text-kaydo" />}
        onDismiss={snooze}
        dismissLabel={t('feedbackHint.notNow')}
      />
      {open && (
        <Suspense fallback={null}>
          <FeedbackModal
            onClose={() => setOpen(false)}
            onSent={() => { thank(); setSent(true) }}
          />
        </Suspense>
      )}
    </>
  )
}
