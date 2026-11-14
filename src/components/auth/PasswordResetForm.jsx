import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mail, MailCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { devWarn } from '../../utils/devLog'

// Errors that say nothing about whether an account exists, and so may be shown
// as they are. Everything else reads as the generic line.
const ERROR_KEYS = {
  'auth/invalid-email': 'reset.errors.invalidEmail',
  'auth/missing-email': 'reset.errors.invalidEmail',
  'auth/too-many-requests': 'reset.errors.tooManyRequests',
  'auth/network-request-failed': 'reset.errors.network',
}

/**
 * "Forgot password" for admins, in place of the admin login form.
 *
 * The confirmation reads the same whether or not the address has an account
 * (see sendAdminPasswordReset in AuthContext), so this form cannot be used to
 * find out who is an admin of Kaydo.
 */
export default function PasswordResetForm({ initialEmail = '', onBack, tone = 'light' }) {
  const { t, i18n } = useTranslation('auth')
  const { sendAdminPasswordReset } = useAuth()
  const [email, setEmail] = useState(initialEmail)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  // The login page renders a mobile and a desktop form at once.
  const emailId = useId()

  const labelClass = tone === 'dark' ? 'text-cream' : 'text-bark'
  const subtleClass = tone === 'dark' ? 'text-cream/80' : 'text-bark-light'
  const linkClass = tone === 'dark' ? 'text-cream/70 hover:text-cream' : 'text-bark-muted hover:text-kaydo'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (sending) return
    setError('')
    setSending(true)
    try {
      await sendAdminPasswordReset(email.trim(), i18n.resolvedLanguage)
      setSent(true)
    } catch (err) {
      devWarn('Password reset email failed:', err?.code)
      setError(t(ERROR_KEYS[err?.code] || 'reset.errors.generic'))
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-5" role="status">
        <div className="flex justify-center">
          <MailCheck className="w-10 h-10 text-kaydo" />
        </div>
        <p className={`text-sm text-center ${labelClass}`}>
          {t('reset.sent', { email: email.trim() })}
        </p>
        <p className={`text-sm text-center ${subtleClass}`}>{t('reset.sentHint')}</p>
        <button type="button" onClick={onBack} className="btn-kaydo w-full">
          {t('reset.backToLogin')}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className={`text-lg font-semibold ${labelClass}`}>{t('reset.title')}</h2>
        <p className={`text-sm mt-1 ${subtleClass}`}>{t('reset.description')}</p>
      </div>

      <div>
        <label htmlFor={emailId} className={`block text-sm font-medium ${labelClass} mb-1.5`}>
          {t('reset.emailLabel')}
        </label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
          <input
            id={emailId}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('login.form.familyEmailPlaceholder')}
            className="w-full pl-12 pr-4 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-kaydo/30"
            required
          />
        </div>
      </div>

      <p className={`text-xs ${subtleClass}`}>{t('reset.viewerHint')}</p>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="btn-kaydo w-full flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {sending
          ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : t('reset.submit')}
      </button>

      <div className="text-center">
        <button type="button" onClick={onBack} className={`text-sm transition-colors ${linkClass}`}>
          {t('reset.backToLogin')}
        </button>
      </div>
    </form>
  )
}
