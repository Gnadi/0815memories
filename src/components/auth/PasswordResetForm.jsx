import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mail } from 'lucide-react'
import { requestPasswordReset } from '../../services/passwordReset'

/**
 * "Forgot password?" for admins: Firebase emails a link to set a new one. The
 * answer is the same whether or not the address has an account, so the form
 * cannot be used to find out who does.
 *
 * LoginForm loads it on demand: it is the login page's, but only for the few
 * visitors who need it.
 */
export default function PasswordResetForm({ initialEmail = '', onBack, tone = 'light' }) {
  const { t, i18n } = useTranslation('auth')
  const [email, setEmail] = useState(initialEmail)
  const [sentTo, setSentTo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const labelClass = tone === 'dark' ? 'text-cream' : 'text-bark'
  const subtleClass = tone === 'dark' ? 'text-cream/80' : 'text-bark-light'

  const handleSubmit = async (e) => {
    e.preventDefault()
    const address = email.trim()
    setError('')
    setLoading(true)
    try {
      await requestPasswordReset(address, i18n.language)
      setSentTo(address)
    } catch (err) {
      // Only projects without email enumeration protection answer
      // user-not-found, and saying so would be exactly what it protects.
      if (err?.code === 'auth/user-not-found') setSentTo(address)
      else if (err?.code === 'auth/invalid-email' || err?.code === 'auth/missing-email') setError(t('reset.errors.invalidEmail'))
      else if (err?.code === 'auth/too-many-requests') setError(t('reset.errors.tooManyRequests'))
      else setError(t('reset.errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  const backButton = (
    <button type="button" onClick={onBack} className={`text-sm font-medium underline underline-offset-2 ${subtleClass}`}>
      {t('reset.back')}
    </button>
  )

  if (sentTo) {
    return (
      <div className="space-y-5">
        <h2 className={`text-lg font-semibold ${labelClass}`}>{t('reset.title')}</h2>
        <p role="status" className={`text-sm ${subtleClass}`}>{t('reset.sent', { email: sentTo })}</p>
        {backButton}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className={`text-lg font-semibold ${labelClass}`}>{t('reset.title')}</h2>
        <p className={`text-sm mt-1 ${subtleClass}`}>{t('reset.body')}</p>
      </div>

      <div>
        <label htmlFor="reset-email" className={`block text-sm font-medium ${labelClass} mb-1.5`}>
          {t('reset.emailLabel')}
        </label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
          <input
            id="reset-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('login.form.familyEmailPlaceholder')}
            autoComplete="email"
            autoFocus
            required
            className="w-full pl-12 pr-4 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-kaydo/30"
          />
        </div>
      </div>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-kaydo w-full flex items-center justify-center gap-2 text-lg disabled:opacity-60"
      >
        {loading
          ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : t('reset.submit')}
      </button>

      {backButton}
    </form>
  )
}
