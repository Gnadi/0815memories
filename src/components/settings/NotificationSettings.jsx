import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { devError } from '../../utils/devLog'
import SettingSwitch from './SettingSwitch'
import { disablePush, enablePush, isPushOptedOut, isPushSupported } from '../../utils/notifications'

// Whether this device gets push notifications. Per device, like the token it
// registers, so a viewer decides for their own phone without an account.
//
// A page cannot revoke a permission the browser granted, so "off" is an
// opt-out remembered on the device plus the token removed (disablePush). And a
// permission the browser denied cannot be asked for again, so that case only
// says where to change it.

function initialState() {
  if (!isPushSupported() || !import.meta.env.VITE_FIREBASE_VAPID_KEY) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  return Notification.permission === 'granted' && !isPushOptedOut() ? 'on' : 'off'
}

export default function NotificationSettings() {
  const { t } = useTranslation('settings')
  const { familyId, isDemo } = useAuth()
  // A demo tab has no Firebase to register with.
  const [state, setState] = useState(() => (isDemo ? 'demo' : initialState()))
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const labelId = useId()

  const toggle = async () => {
    setBusy(true)
    setFailed(false)
    try {
      if (state === 'on') {
        await disablePush()
        setState('off')
      } else {
        const token = await enablePush(familyId)
        setState(token ? 'on' : initialState())
      }
    } catch (err) {
      devError('changing notifications failed:', err?.code, err?.message)
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const hint = {
    unsupported: t('notifications.unsupported'),
    blocked: t('notifications.blocked'),
    demo: t('demo:unavailable'),
  }[state]
  const on = state === 'on'

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div id={labelId} className="flex items-center gap-1.5 text-sm font-medium text-bark mb-1.5">
            <Bell className="w-4 h-4" />
            {t('notifications.label')}
          </div>
          <p className="text-xs text-bark-muted">{t('notifications.description')}</p>
        </div>
        {!hint && <SettingSwitch on={on} onToggle={toggle} disabled={busy} labelledBy={labelId} />}
      </div>
      {(hint || failed) && (
        <p className="text-xs text-kaydo bg-cream-dark px-3 py-2 rounded-lg mt-3" role="status">
          {failed ? t('notifications.failed') : hint}
        </p>
      )}
    </div>
  )
}
