import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { devError } from '../../utils/devLog'

// What Firebase answers for a password that does not match, by SDK version.
const WRONG_PASSWORD = ['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials']

/**
 * Asks the signed-in admin for their password again before something that
 * cannot be taken back. A session that was left open on a shared device is
 * not proof that the person in front of it is the admin, so removing an admin,
 * deleting the family and deleting the account all go through here first.
 *
 * `onConfirmed` runs once Firebase has accepted the password. The demo has no
 * password to check; its panels say that the action needs a server before
 * they open this.
 */
export default function ReauthDialog({ title, description, confirmLabel, onConfirmed, onCancel }) {
  const { reauthenticate } = useAuth()
  const { t } = useTranslation('settings')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (busy || !password) return
    setBusy(true)
    setError('')
    try {
      await reauthenticate(password)
    } catch (err) {
      devError('Reauthentication failed:', err?.code)
      setError(
        WRONG_PASSWORD.includes(err?.code)
          ? t('reauth.wrongPassword')
          : err?.code === 'auth/too-many-requests'
            ? t('reauth.tooManyRequests')
            : t('reauth.failed'),
      )
      setBusy(false)
      return
    }
    setBusy(false)
    onConfirmed()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bark/40 px-4" role="presentation">
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reauth-title"
        className="w-full max-w-sm bg-warm-white rounded-2xl p-5 shadow-xl"
      >
        <div id="reauth-title" className="flex items-center gap-1.5 text-sm font-medium text-bark mb-1.5">
          <ShieldCheck className="w-4 h-4" />
          {title || t('reauth.title')}
        </div>
        <p className="text-xs text-bark-muted mb-3">{description || t('reauth.description')}</p>
        <label htmlFor="reauth-password" className="block text-xs text-bark mb-1.5">
          {t('reauth.passwordLabel')}
        </label>
        <input
          id="reauth-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus
          className="w-full px-4 py-2.5 bg-cream rounded-xl text-sm text-bark outline-none focus:ring-2 focus:ring-red-300"
        />
        {error && <p className="text-sm text-rose-700 bg-rose-50 px-4 py-2 rounded-lg mt-3" role="alert">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm text-bark hover:bg-cream-dark disabled:opacity-50"
          >
            {t('reauth.cancel')}
          </button>
          <button
            type="submit"
            disabled={busy || !password}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-700 text-white text-sm font-semibold disabled:opacity-40"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel || t('reauth.confirm')}
          </button>
        </div>
      </form>
    </div>
  )
}
