import { useState, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquareHeart } from 'lucide-react'

// Lazy: the form sits behind a button most sessions never press, and it is
// mounted on every signed-in screen through the sidebar and the mobile header.
const FeedbackModal = lazy(() => import('./FeedbackModal'))

/**
 * The button that opens the feedback form, plus the form itself.
 *
 * Both entry points render this rather than lifting the open/closed state into
 * the sidebar and the header separately — one component, one piece of state,
 * and the modal is loaded at most once.
 *
 * `variant` picks the button, not the dialog: 'sidebar' is the full-width row
 * that matches the navigation items, 'icon' the compact header button.
 */
export default function FeedbackLauncher({ variant = 'sidebar' }) {
  const { t } = useTranslation('feedback')
  const [open, setOpen] = useState(false)

  const button = variant === 'icon' ? (
    <button
      onClick={() => setOpen(true)}
      className="p-2 text-bark-light hover:text-kaydo transition-colors"
      aria-label={t('launcher.label')}
    >
      <MessageSquareHeart className="w-5 h-5" />
    </button>
  ) : (
    <button
      onClick={() => setOpen(true)}
      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-bark-light hover:bg-cream-dark hover:text-bark transition-colors"
    >
      <MessageSquareHeart className="w-5 h-5" />
      {t('launcher.label')}
    </button>
  )

  return (
    <>
      {button}
      {open && (
        // No fallback: a spinner behind a modal that has not opened yet reads
        // as a glitch. The chunk is small and the button stays where it was.
        <Suspense fallback={null}>
          <FeedbackModal onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
