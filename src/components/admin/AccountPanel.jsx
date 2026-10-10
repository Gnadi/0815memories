import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { changePassword } from '../../services/account'
import { MIN_PASSWORD_LENGTH } from '../../constants/auth'
import { devError } from '../../utils/devLog'

const INPUT_CLASS =
  'w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark text-base placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30'

function errorKey(code) {
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') return 'wrongCurrent'
  if (code === 'auth/too-many-requests') return 'tooManyRequests'
  if (code === 'auth/weak-password') return 'tooShort'
  return 'generic'
}

/**
 * The admin's own account: the password they sign in with. Not to be mixed up
 * with the family password for guests further up, which every admin shares.
 */
export default function AccountPanel() {
  const { user, isDemo } = useAuth()
  const { t } = useTranslation('settings')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const fail = (text) => setMessage({ ok: false, text })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (next.length < MIN_PASSWORD_LENGTH) return fail(t('account.password.errors.tooShort', { min: MIN_PASSWORD_LENGTH }))
    if (next !== repeat) return fail(t('account.password.errors.mismatch'))
    // The demo's admin has no Firebase account to change.
    if (isDemo) return fail(t('demo:unavailable'))

    setSaving(true)
    setMessage(null)
    try {
      await changePassword(current, next)
      setCurrent('')
      setNext('')
      setRepeat('')
      setMessage({ ok: true, text: t('account.password.changed') })
    } catch (err) {
      devError('changePassword failed:', err?.code)
      fail(t(`account.password.errors.${errorKey(err?.code)}`, { min: MIN_PASSWORD_LENGTH }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-6 pt-6 border-t border-cream-dark">
      <h3 className="text-sm font-medium text-bark mb-1.5 flex items-center gap-1.5">
        <User className="w-4 h-4" />
        {t('account.title')}
      </h3>
      {user?.email && (
        <p className="text-xs text-bark-muted mb-4">{t('account.signedInAs', { email: user.email })}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <p className="text-sm font-medium text-bark">{t('account.password.title')}</p>
          <p className="text-xs text-bark-muted mt-0.5">{t('account.password.description')}</p>
        </div>
        {/* Tells a password manager which account the new password is for. */}
        <input type="email" autoComplete="username" value={user?.email || ''} readOnly hidden />
        <input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder={t('account.password.current')}
          aria-label={t('account.password.current')}
          required
          className={INPUT_CLASS}
        />
        <input
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder={t('account.password.new', { min: MIN_PASSWORD_LENGTH })}
          aria-label={t('account.password.new', { min: MIN_PASSWORD_LENGTH })}
          required
          className={INPUT_CLASS}
        />
        <input
          type="password"
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          placeholder={t('account.password.repeat')}
          aria-label={t('account.password.repeat')}
          required
          className={INPUT_CLASS}
        />
        {message && (
          <p role="status" className={`text-sm px-4 py-2 rounded-lg ${message.ok ? 'text-kaydo bg-cream-dark' : 'text-red-600 bg-red-50'}`}>
            {message.text}
          </p>
        )}
        <button type="submit" disabled={saving} className="btn-kaydo text-sm px-4 disabled:opacity-60">
          {t('account.password.submit')}
        </button>
      </form>
    </div>
  )
}
