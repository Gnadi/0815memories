import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { changePassword, deleteFamily, deleteOwnAccount } from '../../services/account'
import { getFamily } from '../../services/family'
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

function deleteErrorKey(code) {
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') return 'wrongPassword'
  if (code === 'auth/too-many-requests') return 'tooManyRequests'
  return 'generic'
}

/**
 * Leaving for good. An admin deletes their account and leaves the family; the
 * owner can only delete the whole family, which is theirs, and names it to do
 * so. Both confirm their password first.
 */
function DangerZone({ isOwner, familyName }) {
  const { familyId, isDemo, logout } = useAuth()
  const { t } = useTranslation('settings')
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [typedName, setTypedName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const area = isOwner ? 'deleteFamily' : 'deleteAccount'
  const ready = password && (!isOwner || typedName.trim() === familyName.trim())

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!ready) return
    if (isDemo) return setError(t('demo:unavailable'))
    if (!window.confirm(t(`account.${area}.confirm`))) return
    setBusy(true)
    setError('')
    try {
      if (isOwner) await deleteFamily(familyId, password)
      else await deleteOwnAccount(familyId, password)
      await logout()
      navigate('/', { replace: true })
    } catch (err) {
      devError(`${area} failed:`, err?.code)
      setError(t(`account.errors.${deleteErrorKey(err?.code)}`))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 rounded-2xl border border-red-200 bg-red-50/50 p-4 space-y-3">
      <p className="text-sm font-medium text-red-700 flex items-center gap-1.5">
        <AlertTriangle className="w-4 h-4" />
        {t(`account.${area}.title`)}
      </p>
      <p className="text-xs text-bark-muted">{t(`account.${area}.description`)}</p>
      {isOwner && (
        <input
          type="text"
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          placeholder={familyName}
          aria-label={t('account.deleteFamily.typeName', { name: familyName })}
          autoComplete="off"
          className={INPUT_CLASS}
        />
      )}
      <input
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t('account.password.current')}
        aria-label={t(`account.${area}.password`)}
        className={INPUT_CLASS}
      />
      {isOwner && (
        <p className="text-xs text-bark-muted">{t('account.deleteFamily.typeName', { name: familyName })}</p>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={!ready || busy}
        className="text-sm font-medium px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
      >
        {t(`account.${area}.submit`)}
      </button>
    </form>
  )
}

/**
 * The admin's own account: the password they sign in with. Not to be mixed up
 * with the family password for guests further up, which every admin shares.
 */
export default function AccountPanel() {
  const { user, isDemo, familyId } = useAuth()
  const [family, setFamily] = useState(null)

  useEffect(() => {
    if (!familyId) return
    let active = true
    getFamily(familyId)
      .then((data) => { if (active) setFamily(data) })
      .catch((err) => devError('AccountPanel could not load the family:', err))
    return () => { active = false }
  }, [familyId])

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

      {family && user && (
        <DangerZone isOwner={family.adminUid === user.uid} familyName={family.familyName || ''} />
      )}
    </div>
  )
}
