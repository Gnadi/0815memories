import { useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { KeyRound, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { devError } from '../../utils/devLog'
import SettingSwitch from './SettingSwitch'

// "Stay logged in" for the session already open, and a way out that is easy to
// find. Both matter most on a shared tablet: whoever set it up for a
// grandparent should be able to see, and change, whether the family stays
// open on it.
export default function SessionSettings() {
  const { t } = useTranslation('settings')
  const { stayLoggedIn, setStayLoggedIn, logout, isDemo } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const labelId = useId()

  const toggle = async () => {
    setBusy(true)
    setFailed(false)
    try {
      await setStayLoggedIn(!stayLoggedIn)
    } catch (err) {
      devError('changing auth persistence failed:', err?.code, err?.message)
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div id={labelId} className="flex items-center gap-1.5 text-sm font-medium text-bark mb-1.5">
            <KeyRound className="w-4 h-4" />
            {t('session.label')}
          </div>
          <p className="text-xs text-bark-muted">
            {stayLoggedIn ? t('session.on') : t('session.off')}
          </p>
        </div>
        {/* The demo has no session to keep. */}
        {!isDemo && <SettingSwitch on={stayLoggedIn} onToggle={toggle} disabled={busy} labelledBy={labelId} />}
      </div>
      {failed && (
        <p className="text-xs text-kaydo bg-cream-dark px-3 py-2 rounded-lg mt-3" role="status">
          {t('session.failed')}
        </p>
      )}
      <button
        type="button"
        onClick={handleLogout}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cream-dark text-sm font-medium text-bark hover:text-kaydo transition-colors"
      >
        <LogOut className="w-4 h-4" />
        {t('common:buttons.leaveRoom')}
      </button>
    </div>
  )
}
