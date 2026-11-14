import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { UserX, Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useFamilyDeletion } from '../../hooks/useFamilyDeletion'
import { deleteMyAccount } from '../../services/admins'
import { needsFreshLogin } from '../../services/callable'
import { devError } from '../../utils/devLog'
import ReauthDialog from './ReauthDialog'

/**
 * Deleting one's own account, for an admin who is not the owner. Leaving the
 * family and deleting the sign-in is one call to the server
 * (functions/membership.js); this asks twice, once to confirm and once for the
 * password. The owner's account goes with the family, so the owner is only
 * told that.
 */
export default function DeleteAccountPanel() {
  const { familyId, user, isAdmin, isDemo, logout } = useAuth()
  const { t } = useTranslation('settings')
  const navigate = useNavigate()
  const { loading, ownerUid } = useFamilyDeletion(familyId)
  const [askPassword, setAskPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  // Viewers have no account of their own to delete.
  if (loading || !user || !isAdmin) return null
  const isOwner = user.uid === ownerUid

  const start = () => {
    if (busy) return
    if (isDemo) {
      setMessage(t('demo:unavailable'))
      return
    }
    setMessage('')
    if (window.confirm(t('deleteAccount.confirm'))) setAskPassword(true)
  }

  const run = async () => {
    setAskPassword(false)
    setBusy(true)
    try {
      await deleteMyAccount()
    } catch (err) {
      devError('Account deletion failed:', err?.code, err?.message)
      setMessage(
        needsFreshLogin(err)
          ? t('reauth.stale')
          : err?.code === 'functions/failed-precondition'
            ? t('deleteAccount.ownerFirst')
            : t('deleteAccount.failed'),
      )
      setBusy(false)
      return
    }
    // The account is gone; signing out clears what this browser still holds.
    await logout().catch((err) => devError('Sign-out after account deletion failed:', err?.message))
    navigate('/')
  }

  return (
    <div className="mt-6 pt-6 border-t border-cream-dark">
      <div className="flex items-center gap-1.5 text-sm font-medium text-red-700 mb-1.5">
        <UserX className="w-4 h-4" />
        {t('deleteAccount.label')}
      </div>

      {isOwner ? (
        <p className="text-xs text-bark-muted">{t('deleteAccount.ownerNote')}</p>
      ) : (
        <>
          <p className="text-xs text-bark-muted mb-3">{t('deleteAccount.description')}</p>
          <button
            type="button"
            onClick={start}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-700 text-white text-sm font-semibold disabled:opacity-40"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('deleteAccount.submit')}
          </button>
        </>
      )}

      {message && <p className="text-sm text-bark mt-3" role="status">{message}</p>}

      {askPassword && (
        <ReauthDialog
          title={t('deleteAccount.label')}
          description={t('deleteAccount.reauthDescription')}
          confirmLabel={t('deleteAccount.submit')}
          onConfirmed={run}
          onCancel={() => setAskPassword(false)}
        />
      )}
    </div>
  )
}
