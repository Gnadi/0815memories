import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, Unlock, Trash2, MoreVertical, Calendar, Star, BookOpen } from 'lucide-react'
import { isUnlocked } from '../../hooks/useBlackBox'
import EncryptedImage from '../media/EncryptedImage'
import EncryptedVideo from '../media/EncryptedVideo'
import EncryptedAudio from '../media/EncryptedAudio'

export default function BlackBoxCard({ box, kidName, onDelete }) {
  const { t } = useTranslation('blackbox')
  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const unlocked = isUnlocked(box)

  function formatUnlockDate(box) {
    if (box.triggerType === 'legacy') return t('card.uponLegacyTrigger')
    if (!box.unlockDate) return t('card.unknownDate')
    const d = box.unlockDate.toDate ? box.unlockDate.toDate() : new Date(box.unlockDate)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  function getTriggerDescription(box) {
    if (box.triggerType === 'legacy') return t('card.legacyDescription')
    if (box.triggerType === 'milestone') {
      const milestoneLabel = box.milestone
        ? t(`milestones.${box.milestone}`, { defaultValue: box.milestone })
        : ''
      return t('card.milestoneDescription', { milestone: milestoneLabel })
    }
    if (box.triggerType === 'specificDate') return t('card.specificDateDescription', { date: formatUnlockDate(box) })
    return ''
  }

  const triggerDesc = getTriggerDescription(box)
  const unlockDateStr = formatUnlockDate(box)

  return (
    <div
      className={`rounded-2xl border shadow-sm overflow-hidden transition-all ${
        unlocked
          ? 'bg-warm-white border-cream-dark'
          : 'bg-bark text-white border-bark'
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-4 p-5">
        {/* Lock icon */}
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
            unlocked ? 'bg-green-100' : 'bg-white/10'
          }`}
        >
          {unlocked ? (
            <Unlock className="w-6 h-6 text-green-700" />
          ) : (
            <Lock className="w-6 h-6 text-white" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className={`font-bold text-base truncate ${unlocked ? 'text-bark' : 'text-white'}`}>
            {box.title || t('card.untitled')}
          </h3>
          {kidName && (
            <p className={`text-xs mt-0.5 ${unlocked ? 'text-bark-muted' : 'text-white/60'}`}>
              {t('card.for', { name: kidName })}
            </p>
          )}
          <p className={`text-xs mt-1 ${unlocked ? 'text-bark-muted' : 'text-white/70'}`}>
            {triggerDesc}
          </p>
        </div>

        {/* Menu */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={`p-1.5 rounded-lg ${unlocked ? 'text-bark-muted hover:text-bark' : 'text-white/60 hover:text-white'}`}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 bg-white rounded-xl shadow-lg border border-cream-dark z-10 min-w-[140px] py-1">
              <button
                onClick={() => { setMenuOpen(false); onDelete() }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" /> {t('common:buttons.delete')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      {!unlocked ? (
        <div className="px-5 pb-4">
          <div className="bg-white/10 rounded-xl px-3 py-2 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-kaydo flex-shrink-0" />
            <p className="text-xs text-white/80">
              {t('card.sealedUntilPrefix')}{' '}
              <span className="text-kaydo font-semibold">{unlockDateStr}</span>{t('card.sealedUntilSuffix')}
            </p>
          </div>
        </div>
      ) : (
        <div>
          {/* Unlocked — show content toggle */}
          <div className="px-5 pb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
              <Unlock className="w-3 h-3" /> {t('card.unlocked')}
            </span>
          </div>

          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full text-left px-5 pb-4 text-sm text-kaydo font-semibold hover:text-kaydo/80"
          >
            {expanded ? t('card.hideContents') : t('card.viewContents')}
          </button>

          {expanded && (
            <div className="px-5 pb-5 border-t border-cream-dark pt-4 space-y-3">
              {box.message && (
                <p className="text-sm text-bark leading-relaxed whitespace-pre-wrap">{box.message}</p>
              )}
              {box.photos?.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {box.photos.map((url, i) => (
                    <EncryptedImage key={i} src={url} alt="" className="w-24 h-24 rounded-xl object-cover" />
                  ))}
                </div>
              )}
              {box.voiceNote?.url && (
                <EncryptedAudio src={box.voiceNote.url} controls className="w-full mt-2" />
              )}
              {box.videos?.length > 0 && (
                <div className="space-y-2 mt-2">
                  {box.videos.map((v, i) => (
                    <EncryptedVideo
                      key={v.publicId || i}
                      src={v.url}
                      controls
                      playsInline
                      className="w-full rounded-xl bg-black max-h-64"
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
