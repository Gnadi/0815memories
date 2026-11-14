import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MailWarning } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { devWarn } from '../../utils/devLog'

/**
 * Asks an admin whose email address was never confirmed to confirm it.
 *
 * New admins cannot get this far unconfirmed — firestore.rules refuses them a
 * family until they have — but admins from before that check can. Their access
 * stays, since taking it away would lock families out of their own memories.
 * Until they confirm, though, a password reset for their account goes to an
 * address nobody has shown to be theirs.
 */
export default function VerifyEmailBanner() {
  const { t, i18n } = useTranslation('home')
  const { user, isAdmin, isDemo, emailVerified, sendVerificationEmail, checkEmailVerified } = useAuth()
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  if (!user || !isAdmin || isDemo || emailVerified) return null

  const run = async (action) => {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      await action()
    } catch (err) {
      devWarn('Email confirmation failed:', err?.code)
      setMessage(t(err?.code === 'auth/too-many-requests' ? 'verifyEmail.tooManyRequests' : 'verifyEmail.failed'))
    } finally {
      setBusy(false)
    }
  }

  const handleSend = () => run(async () => {
    await sendVerificationEmail(i18n.resolvedLanguage)
    setSent(true)
    setMessage(t('verifyEmail.sent', { email: user.email || '' }))
  })

  const handleCheck = () => run(async () => {
    if (!(await checkEmailVerified())) setMessage(t('verifyEmail.notYet'))
  })

  return (
    <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl px-4 py-3 text-sm" role="status">
      <div className="flex items-start gap-3">
        <MailWarning className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{t('verifyEmail.title')}</p>
          <p className="mt-1">{t('verifyEmail.body', { email: user.email || '' })}</p>
          {message && <p className="mt-2">{message}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSend}
              disabled={busy}
              className="px-4 py-2 rounded-full bg-amber-900 text-amber-50 font-semibold disabled:opacity-60"
            >
              {sent ? t('verifyEmail.resend') : t('verifyEmail.send')}
            </button>
            {sent && (
              <button
                type="button"
                onClick={handleCheck}
                disabled={busy}
                className="px-4 py-2 rounded-full border border-amber-300 font-semibold disabled:opacity-60"
              >
                {t('verifyEmail.confirmed')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
