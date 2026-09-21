import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { X, Star, Loader2, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useFeedbackWriter } from '../hooks/useFeedback'
import {
  FEEDBACK_CATEGORIES,
  DEFAULT_FEEDBACK_CATEGORY,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_CONTACT_MAX,
  FEEDBACK_RATING_MAX,
} from '../constants/feedback'
import { devError } from '../utils/devLog'

/**
 * "How is the app treating you?" — a note to whoever runs Kaydo, not to the
 * family. Open to viewers as well as admins: the people living in a family's
 * space are mostly viewers, and they are the ones with the most to say about it.
 */
export default function FeedbackModal({ onClose }) {
  const { t, i18n } = useTranslation('feedback')
  const { familyId, user, isViewer } = useAuth()
  const location = useLocation()
  const { submitFeedback } = useFeedbackWriter(familyId, {
    uid: user?.uid ?? null,
    // Read off isViewer rather than isAdmin: 'viewer' is minted by the login
    // function and always present, while an admin's claim lands a moment after
    // their family does — and for that moment isAdmin is false, which would
    // file an admin's feedback under the wrong role.
    role: isViewer ? 'viewer' : 'admin',
  })

  const [rating, setRating] = useState(0)
  const [category, setCategory] = useState(DEFAULT_FEEDBACK_CATEGORY)
  const [message, setMessage] = useState('')
  // Admins have an email on their account; viewers share a password and have
  // none, so the field starts empty for them and stays optional for everyone.
  const [contact, setContact] = useState(() => user?.email ?? '')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSending(true)
    try {
      await submitFeedback({
        message,
        category,
        rating,
        contact,
        path: location.pathname,
        language: i18n.language,
        userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
      })
      setSent(true)
    } catch (err) {
      devError('Feedback submission failed:', err)
      // A validation failure names the field; anything else (offline, a denied
      // write) gets the one line that is true in every such case.
      setError(err?.translationKey ? t(err.translationKey) : t('errors.sendFailed'))
      setSending(false)
    }
  }

  // Clears the home indicator and any on-screen chrome below the sheet, so the
  // send button is not the thing sitting under the gesture bar.
  const safeBottom = { paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }

  const dialog = (
    // z-50 would be enough on its own, but the launcher lives inside the mobile
    // header — `sticky ... z-30`, which is a stacking context — so a dialog
    // rendered in place was trapped underneath the bottom nav at z-40 no matter
    // what it asked for. The portal is what actually fixes that; the explicit
    // z-[60] keeps it above the nav's own create sheet (z-50) as well.
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('modal.title')}
        // A column with its own scroll region: the header and the send button
        // are pinned, only the fields between them move. On a phone it opens as
        // a bottom sheet, so the button lands under the thumb rather than at
        // the end of a scroll.
        className="relative bg-warm-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[92vh] sm:max-h-[90vh]"
      >
        <div className="flex-shrink-0 flex items-center justify-between p-5 border-b border-cream-dark">
          <h2 className="text-lg font-bold text-bark">{t('modal.title')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-bark-muted hover:text-bark"
            aria-label={t('modal.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {sent ? (
          <div className="p-8 text-center space-y-3" style={safeBottom}>
            <div className="w-12 h-12 mx-auto rounded-full bg-kaydo/10 flex items-center justify-center">
              <Check className="w-6 h-6 text-kaydo" />
            </div>
            <p className="text-base font-semibold text-bark">{t('sent.title')}</p>
            <p className="text-sm text-bark-muted">{t('sent.body')}</p>
            <button type="button" onClick={onClose} className="btn-kaydo w-full mt-2">
              {t('sent.done')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
              <p className="text-sm text-bark-muted">{t('modal.subtitle')}</p>

              {/* Rating — optional, and says so, so an empty row does not read
                  as an unfilled required field. */}
              <div>
                <span className="block text-sm font-medium text-bark mb-1">{t('rating.label')}</span>
                <div className="flex items-center gap-1" role="radiogroup" aria-label={t('rating.label')}>
                  {Array.from({ length: FEEDBACK_RATING_MAX }, (_, i) => i + 1).map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={rating === value}
                      aria-label={t('rating.star', { count: value })}
                      // Tapping the chosen star again clears the rating — the
                      // only way back to "no answer" once a star is lit.
                      onClick={() => setRating((current) => (current === value ? 0 : value))}
                      className="p-1 text-bark-muted hover:text-kaydo transition-colors"
                    >
                      <Star
                        className={`w-7 h-7 ${value <= rating ? 'fill-kaydo text-kaydo' : ''}`}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-xs text-bark-muted mt-1.5">{t('rating.hint')}</p>
              </div>

              <div>
                <span className="block text-sm font-medium text-bark mb-1">{t('category.label')}</span>
                <div className="flex flex-wrap gap-2">
                  {FEEDBACK_CATEGORIES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={category === value}
                      onClick={() => setCategory(value)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        category === value
                          ? 'bg-kaydo text-white'
                          : 'bg-cream-dark text-bark-light hover:text-bark'
                      }`}
                    >
                      {t(`category.${value}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="feedback-message" className="block text-sm font-medium text-bark mb-1">
                  {t('message.label')}
                </label>
                <textarea
                  id="feedback-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={FEEDBACK_MESSAGE_MAX}
                  placeholder={t('message.placeholder')}
                  className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30 resize-y"
                />
                <p className="text-xs text-bark-muted mt-1.5 text-right">
                  {t('message.counter', { count: message.length, max: FEEDBACK_MESSAGE_MAX })}
                </p>
              </div>

              <div>
                <label htmlFor="feedback-contact" className="block text-sm font-medium text-bark mb-1">
                  {t('contact.label')}
                </label>
                <input
                  id="feedback-contact"
                  type="email"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  maxLength={FEEDBACK_CONTACT_MAX}
                  placeholder={t('contact.placeholder')}
                  className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
                />
                <p className="text-xs text-bark-muted mt-1.5">{t('contact.hint')}</p>
              </div>

              {/* Where the note goes and who reads it. The rest of the app is
                  encrypted before it leaves the browser and this is not, which
                  is worth saying — as reassurance about the audience, not as a
                  warning about the internet. */}
              <p className="text-xs text-bark-muted leading-relaxed">
                {t('privacyNote')}
              </p>
            </div>

            <div
              className="flex-shrink-0 border-t border-cream-dark bg-warm-white px-5 pt-4 rounded-b-2xl"
              style={safeBottom}
            >
              {error && <p className="text-xs text-red-500 text-center mb-2">{error}</p>}
              <button
                type="submit"
                disabled={sending || !message.trim()}
                className="btn-kaydo w-full flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                {sending ? t('actions.sending') : t('actions.send')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )

  // No document during the vite-react-ssg pre-render pass. The dialog only ever
  // mounts on a click in the browser, but the guard keeps it from being a
  // module that cannot be rendered in Node at all.
  if (typeof document === 'undefined') return null
  return createPortal(dialog, document.body)
}
