import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useOurYearChapters, useOurYearRitual } from '../../hooks/useOurYear'
import { occasionLabelFor, ourYearNudge, participantName, partnerUidOf } from '../../utils/ourYear'

/**
 * The entry point to "Our Year" on the home feed — and the only place the
 * ritual ever announces itself. Shows at most one quiet line: a letter that may
 * be opened, a partner waiting, a chapter in progress, or the day that passed.
 *
 * Only ever rendered for the two partners; everyone else sees nothing.
 */
export default function OurYearHomeCard() {
  const { isAdmin, familyId, user, encryptionKey } = useAuth()
  const { t } = useTranslation('ourYear')
  const uid = user?.uid ?? null
  const { ritual, loading } = useOurYearRitual(familyId, uid, encryptionKey)
  const { chapters } = useOurYearChapters(ritual?.id ?? null, encryptionKey)

  if (!isAdmin || loading || !ritual) return null

  const nudge = ourYearNudge(ritual, chapters, uid)
  const partnerLabel =
    participantName(ritual, partnerUidOf(ritual, uid)) || t('partner.genericShort')

  const content = nudge
    ? {
        title: t(`nudge.${nudge.kind}.title`, {
          name: partnerLabel,
          occasion: occasionLabelFor(ritual, t),
        }),
        body: t(`nudge.${nudge.kind}.body`, {
          chapter: nudge.chapter?.title ?? '',
          name: partnerLabel,
          occasion: occasionLabelFor(ritual, t),
        }),
      }
    : { title: t('nudge.setup.title'), body: t('nudge.setup.body') }

  return (
    <Link
      to="/our-year"
      className="block mt-6 rounded-2xl overflow-hidden group bg-warm-white border border-cream-dark hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-4 p-5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-widest text-kaydo uppercase mb-1">
            {t('nudge.eyebrow')}
          </p>
          <p className="font-serif text-xl font-bold text-bark leading-snug">{content.title}</p>
          <p className="text-sm text-bark-muted mt-1">{content.body}</p>
        </div>
        <div className="w-11 h-11 rounded-full bg-cream-dark flex items-center justify-center flex-shrink-0 group-hover:bg-kaydo/10 transition-colors">
          <ChevronRight className="w-5 h-5 text-bark-muted" />
        </div>
      </div>
    </Link>
  )
}
