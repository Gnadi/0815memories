import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLoginPhotoHint } from '../../hooks/useLoginPhotoHint'
import { LOGIN_ART_MOTIFS } from '../auth/loginArtFiles'

/**
 * Suggests to an admin a photo of the family for the login page, beside the
 * picture it shows now (see useLoginPhotoHint for when).
 */
export default function LoginPhotoHint() {
  const { t } = useTranslation('home')
  const { isAdmin, familyId, isDemo } = useAuth()
  // Not in the demo: its home page is the one the landing page's screenshots
  // are taken from, and a visitor there has no family to photograph.
  const { show, snooze } = useLoginPhotoHint(familyId, isAdmin && !isDemo)
  const titleId = useId()

  if (!show) return null

  return (
    <section aria-labelledby={titleId} className="mb-6 bg-warm-white rounded-2xl shadow-sm overflow-hidden flex">
      {/* What the family sees now, so the suggestion needs no imagining */}
      <img
        src={LOGIN_ART_MOTIFS[0].mobile.src}
        alt=""
        loading="lazy"
        className="hidden sm:block w-40 shrink-0 object-cover"
      />
      <div className="flex-1 min-w-0 p-4">
        <h2 id={titleId} className="font-semibold text-bark">{t('loginPhotoHint.title')}</h2>
        <p className="mt-1 text-sm text-bark-light">{t('loginPhotoHint.body')}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link to="/settings#login-image" className="btn-kaydo text-sm px-4 py-2">
            {t('loginPhotoHint.action')}
          </Link>
          <button type="button" onClick={snooze} className="text-sm text-bark-muted hover:text-bark transition-colors">
            {t('loginPhotoHint.notNow')}
          </button>
        </div>
      </div>
    </section>
  )
}
