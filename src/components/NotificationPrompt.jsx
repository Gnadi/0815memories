import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, X } from 'lucide-react'
import { requestAndSaveFCMToken, isPushSupported } from '../utils/notifications'
import { devError } from '../utils/devLog'

const DISMISSED_KEY = 'kaydo_notif_dismissed'
const DISMISSED_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

function isDismissed() {
  const raw = localStorage.getItem(DISMISSED_KEY)
  if (!raw) return false
  return Date.now() < Number(raw)
}

export default function NotificationPrompt({ familyId }) {
  const { t } = useTranslation('common')
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    // Show only if: this browser can actually deliver push (on iOS that means
    // an installed PWA, see isPushSupported), permission not yet decided, and
    // not dismissed.
    if (
      !familyId ||
      !isPushSupported() ||
      !import.meta.env.VITE_FIREBASE_VAPID_KEY ||
      Notification.permission !== 'default' ||
      isDismissed()
    ) return

    // Small delay so it doesn't pop up immediately on page load
    const timer = setTimeout(() => setVisible(true), 2500)
    return () => clearTimeout(timer)
  }, [familyId])

  if (!visible) return null

  const handleEnable = async () => {
    setLoading(true)
    setFailed(false)
    try {
      await requestAndSaveFCMToken(familyId)
      setVisible(false)
    } catch (err) {
      // The old version swallowed this: the token write was rejected by the
      // rules and the card closed as if it had worked, which is why nobody
      // noticed push had never been live.
      devError('enabling notifications failed:', err?.code, err?.message)
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now() + DISMISSED_TTL_MS))
    setVisible(false)
  }

  return (
    <div className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-warm-white rounded-2xl shadow-xl border border-cream-dark flex items-start gap-3 p-4">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-kaydo/10 flex items-center justify-center">
          <Bell className="w-4 h-4 text-kaydo" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-bark">{t('notifications.title')}</p>
          <p className="text-xs text-bark-muted mt-0.5 leading-relaxed">
            {failed ? t('notifications.failed') : t('notifications.body')}
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleEnable}
              disabled={loading}
              className="flex-1 rounded-xl bg-kaydo text-white text-xs font-semibold py-2 hover:bg-kaydo/90 transition-colors disabled:opacity-60"
            >
              {loading
                ? t('notifications.enabling')
                : failed
                  ? t('notifications.retry')
                  : t('notifications.enable')}
            </button>
            <button
              onClick={handleDismiss}
              className="flex-1 rounded-xl bg-cream-dark text-bark text-xs font-semibold py-2 hover:bg-cream-dark/80 transition-colors"
            >
              {t('notifications.notNow')}
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-bark-muted hover:text-bark transition-colors"
          aria-label={t('actions.dismiss')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
