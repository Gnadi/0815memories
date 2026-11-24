import { useTranslation } from 'react-i18next'
import { ImagePlus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useLoginPhotoHint } from '../../hooks/useLoginPhotoHint'
import { LOGIN_ART_MOTIFS } from '../auth/loginArtFiles'
import HomeNoticeCard from './HomeNoticeCard'

/**
 * Suggests to an admin a photo of the family for the login page (see
 * useLoginPhotoHint for when). The picture the login page shows now is the
 * card's background, so the suggestion needs no imagining.
 */
export default function LoginPhotoHint() {
  const { t } = useTranslation('home')
  const { isAdmin, familyId, isDemo } = useAuth()
  // Not in the demo: its home page is the one the landing page's screenshots
  // are taken from, and a visitor there has no family to photograph.
  const { show, snooze } = useLoginPhotoHint(familyId, isAdmin && !isDemo)

  if (!show) return null

  return (
    <HomeNoticeCard
      to="/settings#login-image"
      background="kaydo"
      image={LOGIN_ART_MOTIFS[0].mobile.src}
      eyebrow={t('loginPhotoHint.eyebrow')}
      title={t('loginPhotoHint.title')}
      body={t('loginPhotoHint.body')}
      cta={t('loginPhotoHint.action')}
      icon={<ImagePlus className="w-6 h-6 text-kaydo" />}
      onDismiss={snooze}
      dismissLabel={t('loginPhotoHint.notNow')}
    />
  )
}
