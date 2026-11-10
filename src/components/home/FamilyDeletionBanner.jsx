import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useFamilyDeletion } from '../../hooks/useFamilyDeletion'

/**
 * Tells everyone in the family that it is scheduled for deletion.
 *
 * Only the owner can ask for that, in the settings — where a co-admin or a
 * viewer may not look once in the two weeks before everything is gone. Here
 * they cannot miss it, with time left to save a backup or talk to the owner.
 */
export default function FamilyDeletionBanner() {
  const { t, i18n } = useTranslation('home')
  const { user, isAdmin, familyId } = useAuth()
  const { deleteOn, ownerUid } = useFamilyDeletion(familyId)

  if (!deleteOn) return null

  const date = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'long' }).format(deleteOn)
  const body = !isAdmin
    ? 'familyDeletion.bodyViewer'
    : user?.uid === ownerUid
      ? 'familyDeletion.bodyOwner'
      : 'familyDeletion.bodyAdmin'

  return (
    <div className="mb-6 bg-red-50 border border-red-200 text-red-900 rounded-2xl px-4 py-3 text-sm" role="status">
      <div className="flex items-start gap-3">
        <Trash2 className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{t('familyDeletion.title', { date })}</p>
          <p className="mt-1">{t(body)}</p>
          {isAdmin && (
            <Link to="/settings" className="mt-2 inline-block font-semibold underline">
              {t('familyDeletion.openSettings')}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
