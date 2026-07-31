import { useTranslation } from 'react-i18next'
import { Image as ImageIcon, Lock, Music, MailOpen, Mail, Quote } from 'lucide-react'
import EncryptedImage from '../media/EncryptedImage'
import { formatDay, formatPeriod, letterState } from '../../utils/ourYear'

/**
 * One chapter on the couple's timeline: the title they chose, the period it
 * covers, and the four keepsakes at a glance. Compact on purpose — the full
 * review lives inside the chapter.
 */
export default function ChapterTimelineCard({ chapter, onOpen }) {
  const { t, i18n } = useTranslation('ourYear')
  const locale = i18n.language || 'de'

  const keepsakes = chapter.keepsakes ?? {}
  const closed = chapter.status === 'closed'
  const letter = letterState(chapter)

  const letterLabel = {
    none: t('card.letterNone'),
    draft: t('card.letterNone'),
    sealed: t('card.letterSealed', { date: formatDay(chapter.letterOpenAt, locale) }),
    waiting: t('card.letterWaiting'),
    opened: t('card.letterOpened'),
  }[letter]

  const LetterIcon = letter === 'sealed' ? Lock : letter === 'opened' ? MailOpen : Mail

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left bg-warm-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
    >
      {keepsakes.photoUrl ? (
        <div className="h-44 w-full overflow-hidden">
          <EncryptedImage
            src={keepsakes.photoUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="h-24 w-full bg-cream-dark/60 flex items-center justify-center">
          <ImageIcon className="w-7 h-7 text-kaydo/30" />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-serif text-xl font-bold text-bark leading-snug break-words">
              {chapter.title}
            </h3>
            <p className="text-sm text-bark-muted mt-0.5">
              {formatPeriod(chapter.periodStart, chapter.periodEnd, locale)}
            </p>
          </div>
          <span
            className={`flex-shrink-0 text-xs font-semibold rounded-full px-2.5 py-0.5 ${
              closed ? 'bg-cream-dark text-bark-muted' : 'bg-kaydo/10 text-kaydo'
            }`}
          >
            {closed ? t('chapter.closedBadge') : t('chapter.openBadge')}
          </span>
        </div>

        {(keepsakes.song?.title || keepsakes.quote || keepsakes.moment) && (
          <div className="mt-3 space-y-2">
            {keepsakes.song?.title && (
              <p className="flex items-center gap-2 text-sm text-bark-light">
                <Music className="w-4 h-4 text-bark-muted flex-shrink-0" />
                <span className="truncate">
                  {keepsakes.song.title}
                  {keepsakes.song.artist ? ` · ${keepsakes.song.artist}` : ''}
                </span>
              </p>
            )}
            {keepsakes.quote && (
              <p className="flex items-start gap-2 text-sm text-bark font-serif italic">
                <Quote className="w-4 h-4 text-bark-muted flex-shrink-0 mt-0.5" />
                <span className="line-clamp-2">{keepsakes.quote}</span>
              </p>
            )}
            {keepsakes.moment && (
              <p className="text-sm text-bark-muted line-clamp-2">{keepsakes.moment}</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-cream-dark text-xs text-bark-muted">
          <LetterIcon className="w-3.5 h-3.5 flex-shrink-0" />
          <span className={letter === 'waiting' ? 'text-kaydo font-semibold' : ''}>
            {letterLabel}
          </span>
        </div>
      </div>
    </button>
  )
}
