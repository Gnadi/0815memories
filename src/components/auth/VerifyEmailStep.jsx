import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MailCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { devWarn } from '../../utils/devLog'

// How often the page asks Firebase whether the link has been clicked, so the
// person who confirms in another tab or on their phone finds this page moved on.
const POLL_MS = 5000
// Firebase throttles confirmation mails; this keeps the button from inviting it.
const RESEND_COOLDOWN_MS = 60_000

/**
 * "Confirm your email address", between creating an admin account and founding
 * or joining a family. firestore.rules refuses both until the address is
 * confirmed (hasVerifiedEmail), because a password reset goes to that address.
 *
 * `onVerified` runs once the confirmation is seen.
 */
export default function VerifyEmailStep({ onVerified }) {
  const { t, i18n } = useTranslation('auth')
  const { user, checkEmailVerified, sendVerificationEmail, discardNewAccount, logout } = useAuth()
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [resentAt, setResentAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        if (await checkEmailVerified() && !cancelled) onVerified?.()
      } catch (err) {
        devWarn('Could not check the email confirmation:', err?.code)
      }
    }
    const id = setInterval(poll, POLL_MS)
    window.addEventListener('focus', poll)
    return () => {
      cancelled = true
      clearInterval(id)
      window.removeEventListener('focus', poll)
    }
  }, [checkEmailVerified, onVerified])

  // Ticks only while the resend button is cooling down.
  const coolingDown = resentAt && now - resentAt < RESEND_COOLDOWN_MS
  useEffect(() => {
    if (!coolingDown) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [coolingDown])

  const handleCheck = async () => {
    setError('')
    setMessage('')
    setChecking(true)
    try {
      if (await checkEmailVerified()) onVerified?.()
      else setMessage(t('verify.notYet'))
    } catch (err) {
      devWarn('Could not check the email confirmation:', err?.code)
      setError(t('verify.errors.generic'))
    } finally {
      setChecking(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setMessage('')
    try {
      await sendVerificationEmail(i18n.resolvedLanguage)
      setResentAt(Date.now())
      setNow(Date.now())
      setMessage(t('verify.resent'))
    } catch (err) {
      devWarn('Could not resend the confirmation mail:', err?.code)
      setError(t(err?.code === 'auth/too-many-requests' ? 'verify.errors.tooManyRequests' : 'verify.errors.generic'))
    }
  }

  const handleWrongAddress = async () => {
    if (!window.confirm(t('verify.wrongAddressConfirm', { email: user?.email || '' }))) return
    await discardNewAccount()
  }

  const secondsLeft = coolingDown ? Math.ceil((RESEND_COOLDOWN_MS - (now - resentAt)) / 1000) : 0

  return (
    <div className="space-y-5">
      <div className="flex justify-center">
        <MailCheck className="w-10 h-10 text-kaydo" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold text-bark">{t('verify.title')}</h2>
        <p className="text-sm text-bark-light mt-2">{t('verify.body', { email: user?.email || '' })}</p>
        <p className="text-xs text-bark-muted mt-2">{t('verify.why')}</p>
      </div>

      {message && (
        <p className="text-sm text-bark bg-cream-dark px-4 py-2 rounded-lg" role="status">{message}</p>
      )}
      {error && (
        <p className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg">{error}</p>
      )}

      <button
        type="button"
        onClick={handleCheck}
        disabled={checking}
        className="btn-kaydo w-full flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {checking
          ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : t('verify.confirmed')}
      </button>

      <button
        type="button"
        onClick={handleResend}
        disabled={!!coolingDown}
        className="w-full py-3 border-2 border-cream-dark rounded-full text-kaydo font-semibold hover:bg-cream-dark transition-colors disabled:opacity-60"
      >
        {coolingDown ? t('verify.resendIn', { seconds: secondsLeft }) : t('verify.resend')}
      </button>

      <div className="flex flex-col items-center gap-2 text-sm">
        <button type="button" onClick={handleWrongAddress} className="text-bark-muted hover:text-kaydo transition-colors">
          {t('verify.wrongAddress')}
        </button>
        <button type="button" onClick={() => logout()} className="text-bark-muted hover:text-kaydo transition-colors">
          {t('verify.signOut')}
        </button>
      </div>
    </div>
  )
}
