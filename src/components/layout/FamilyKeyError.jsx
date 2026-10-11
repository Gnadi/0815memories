import { useTranslation } from 'react-i18next'
import KaydoLogo from '../KaydoLogo'
import { useAuth } from '../../context/AuthContext'

/**
 * What ProtectedRoute shows instead of the app when the family's key will not
 * come (AuthContext's keyError). Without it nothing can be read, and anything
 * written would be stored in plaintext.
 */
export default function FamilyKeyError({ reason }) {
  const { t } = useTranslation('common')
  const { logout } = useAuth()

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center">
      <KaydoLogo size={40} className="mb-6" />
      <h1 className="text-xl font-semibold text-bark mb-2">{t('familyKey.title')}</h1>
      <p className="text-bark-light text-sm max-w-sm mb-6 leading-relaxed">{t(`familyKey.${reason}`)}</p>
      <div className="flex flex-col sm:flex-row gap-3">
        {reason !== 'deleted' && (
          <button
            onClick={() => window.location.reload()}
            className="bg-kaydo hover:bg-kaydo-dark text-warm-white font-medium rounded-xl px-6 py-3 transition-colors"
          >
            {t('familyKey.retry')}
          </button>
        )}
        <button
          onClick={() => logout()}
          className="text-bark-light hover:text-bark font-medium rounded-xl px-6 py-3 transition-colors"
        >
          {t('familyKey.signOut')}
        </button>
      </div>
    </div>
  )
}
