import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell } from 'lucide-react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../config/firebase'
import { useAuth } from '../../context/AuthContext'
import { devError } from '../../utils/devLog'

/**
 * Sends one fixed notification to every device in the family.
 *
 * The push chain has four links — the browser's permission, the token document,
 * the Cloud Function, the service worker — and from the outside a failure in
 * any of them looks the same: nothing happens. This exercises all four on
 * demand, and the two error codes it can report say which end is at fault.
 */
export default function TestNotificationPanel() {
  const { familyId } = useAuth()
  const { t } = useTranslation('settings')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')

  const handleSend = async () => {
    if (!familyId || !functions) return
    setSending(true)
    setMessage('')
    try {
      const result = await httpsCallable(functions, 'sendTestNotification')({ familyId })
      setMessage(t('testNotification.sent', { devices: result.data?.devices ?? 0 }))
    } catch (err) {
      devError('sendTestNotification failed:', err?.code, err?.message)
      setMessage(
        err?.code === 'functions/failed-precondition'
          ? t('testNotification.noDevices')
          : `${t('testNotification.failed')} (${err?.code || 'unknown'})`,
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mt-6 pt-6 border-t border-cream-dark">
      <label className="block text-sm font-medium text-bark mb-1.5">
        <div className="flex items-center gap-1.5">
          <Bell className="w-4 h-4" />
          {t('testNotification.label')}
        </div>
      </label>
      <p className="text-xs text-bark-muted mb-3">{t('testNotification.description')}</p>
      <button
        type="button"
        onClick={handleSend}
        disabled={sending || !familyId}
        className="btn-kaydo flex items-center gap-1.5 text-sm px-4 disabled:opacity-60"
      >
        <Bell className="w-4 h-4" />
        {sending ? t('testNotification.sending') : t('testNotification.send')}
      </button>
      {message && <p className="text-xs text-bark-muted mt-2">{message}</p>}
    </div>
  )
}
