import { useTranslation } from 'react-i18next'
import { Image as ImageIcon, Mic, Video } from 'lucide-react'
import { EMOTIONS } from '../../constants/emotions'
import EncryptedImage from '../media/EncryptedImage'
import { entryDate, entryPlainText } from '../../utils/journalContent'

/**
 * One entry in a child's archive: its date set apart on the left, the words on
 * the right, and its first photo when it has one. The whole card opens the
 * entry; editing and deleting happen there.
 */
export default function JournalEntryCard({ entry, onView }) {
  const { t, i18n } = useTranslation('journal')

  const emotion = EMOTIONS.find((e) => e.key === entry.emotion) || EMOTIONS[1]
  const date = entryDate(entry)
  const day = date?.toLocaleDateString(i18n.language, { day: 'numeric' })
  const month = date?.toLocaleDateString(i18n.language, { month: 'short' })
  const fullDate = date?.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const preview = entryPlainText(entry)
  const photos = entry.photos?.length || 0
  const videos = entry.videos?.length || 0
  const voiceMemos = entry.voiceMemos?.length || 0

  return (
    <button
      type="button"
      onClick={onView}
      className="w-full text-left bg-warm-white rounded-2xl border border-cream-dark shadow-sm hover:shadow-md hover:border-cream-darker transition-all flex gap-4 p-4"
    >
      <div className="flex-shrink-0 w-12 text-center pt-0.5" aria-hidden="true">
        <p className="font-serif text-2xl font-bold text-bark leading-none">{day}</p>
        <p className="text-xs uppercase tracking-wide text-bark-muted mt-1">{month}</p>
      </div>

      <div className="flex-1 min-w-0">
        <p className="sr-only">{fullDate}</p>
        {entry.volume && (
          <p className="text-[11px] font-semibold text-kaydo uppercase tracking-widest truncate mb-0.5">{entry.volume}</p>
        )}
        <h3 className="font-serif text-lg font-bold text-bark leading-snug line-clamp-2">
          {entry.title || t('entryCard.untitled')}
        </h3>
        {preview && (
          <p className="text-sm text-bark-muted leading-relaxed line-clamp-3 mt-1">{preview}</p>
        )}

        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2.5 text-xs text-bark-muted">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${emotion.bg} ${emotion.text}`}>
            <span aria-hidden="true">{emotion.emoji}</span> {t('emotions:' + emotion.key)}
          </span>
          {photos > 0 && (
            <span className="inline-flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" /> {t('entryCard.photos', { count: photos })}
            </span>
          )}
          {videos > 0 && (
            <span className="inline-flex items-center gap-1">
              <Video className="w-3.5 h-3.5" aria-hidden="true" /> {t('entryCard.videos', { count: videos })}
            </span>
          )}
          {voiceMemos > 0 && (
            <span className="inline-flex items-center gap-1">
              <Mic className="w-3.5 h-3.5" aria-hidden="true" /> {t('entryCard.voiceMemos', { count: voiceMemos })}
            </span>
          )}
        </div>
      </div>

      {photos > 0 && (
        <EncryptedImage
          src={entry.photos[0]}
          alt=""
          className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover self-center"
        />
      )}
    </button>
  )
}
