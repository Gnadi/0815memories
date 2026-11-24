import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { clearSkyDraft, loadSkyDraft } from '../../utils/sky/skyDraft'
import HomeNoticeCard from './HomeNoticeCard'

/**
 * A birth sky made on the public page before signing in, still waiting in
 * this browser (utils/sky/skyDraft.js). Sign-up leads straight on to it; this
 * is the way back for whoever signed in instead, or confirmed their address in
 * another tab.
 */
export default function SkyDraftHint() {
  const { t } = useTranslation('home')
  const { isAdmin, isDemo } = useAuth()
  const [draft, setDraft] = useState(() => (isAdmin && !isDemo ? loadSkyDraft() : null))

  if (!draft) return null

  return (
    <HomeNoticeCard
      to="/birth-sky/continue"
      background="night"
      eyebrow={t('skyDraftHint.eyebrow')}
      title={t('skyDraftHint.title', { name: draft.name })}
      body={t('skyDraftHint.body')}
      cta={t('skyDraftHint.action')}
      icon={<Sparkles className="w-6 h-6 text-kaydo" />}
      onDismiss={() => {
        clearSkyDraft()
        setDraft(null)
      }}
      dismissLabel={t('skyDraftHint.discard')}
    />
  )
}
