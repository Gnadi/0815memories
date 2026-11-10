import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useFamilyDeletion } from '../../hooks/useFamilyDeletion'
import {
  cancelFamilyDeletion,
  requestFamilyDeletion,
  DELETION_GRACE_DAYS,
} from '../../services/familyDeletion'
import { devError } from '../../utils/devLog'

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * The end of the settings: deleting the family, for its owner.
 *
 * The request only sets a date two weeks out (functions/familyDeletion.js);
 * until then this shows the date to every admin and lets the owner take it
 * back. Typing the family's name is the confirmation, because the click that
 * follows starts the one thing here that cannot be undone.
 */
export default function DeleteFamilyPanel() {
  const { familyId, user, isDemo } = useAuth()
  const { t, i18n } = useTranslation('settings')
  const { loading, deleteOn, ownerUid, familyName } = useFamilyDeletion(familyId)
  const [typedName, setTypedName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const isOwner = !!user && user.uid === ownerUid
  // The other admins have nothing to do here until the owner has asked.
  if (loading || (!isOwner && !deleteOn)) return null

  const run = async (action, done) => {
    if (busy) return
    if (isDemo) {
      setMessage(t('demo:unavailable'))
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await action(familyId)
      setTypedName('')
      setMessage(done)
    } catch (err) {
      devError('Family deletion call failed:', err?.code, err?.message)
      setMessage(
        err?.code === 'functions/permission-denied'
          ? t('deleteFamily.notOwner')
          : err?.code === 'functions/failed-precondition'
            ? t('deleteFamily.alreadyBegun')
            : t('deleteFamily.failed'),
      )
    } finally {
      setBusy(false)
    }
  }

  const date = deleteOn
    ? new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'long' }).format(deleteOn)
    : ''

  return (
    <div className="mt-6 pt-6 border-t border-cream-dark">
      <div className="flex items-center gap-1.5 text-sm font-medium text-red-700 mb-1.5">
        <Trash2 className="w-4 h-4" />
        {t('deleteFamily.label')}
      </div>

      {deleteOn ? (
        <div className="bg-red-50 border border-red-200 text-red-900 rounded-xl px-4 py-3 text-sm" role="status">
          <p className="font-semibold">{t('deleteFamily.scheduledTitle', { date })}</p>
          <p className="mt-1">{t(isOwner ? 'deleteFamily.scheduledOwner' : 'deleteFamily.scheduledAdmin')}</p>
          {isOwner && (
            <button
              type="button"
              onClick={() => run(cancelFamilyDeletion, t('deleteFamily.cancelled'))}
              disabled={busy}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-900 text-red-50 font-semibold disabled:opacity-60"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('deleteFamily.cancel')}
            </button>
          )}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            run(requestFamilyDeletion, '')
          }}
        >
          <p className="text-xs text-bark-muted mb-3">
            {t('deleteFamily.description', { days: DELETION_GRACE_DAYS })}
          </p>
          <label htmlFor="delete-family-name" className="block text-xs text-bark mb-1.5">
            {t('deleteFamily.confirmLabel', { name: familyName })}
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="delete-family-name"
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              autoComplete="off"
              className="flex-1 min-w-0 px-4 py-2.5 bg-cream rounded-xl text-sm text-bark outline-none focus:ring-2 focus:ring-red-300"
            />
            <button
              type="submit"
              disabled={busy || !familyName || !sameName(typedName, familyName)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-700 text-white text-sm font-semibold disabled:opacity-40"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('deleteFamily.submit', { days: DELETION_GRACE_DAYS })}
            </button>
          </div>
        </form>
      )}

      {message && <p className="text-sm text-bark mt-3" role="status">{message}</p>}
    </div>
  )
}
