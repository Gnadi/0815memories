import { useTranslation } from 'react-i18next'
import { Gift, MapPin, X } from 'lucide-react'
import EncryptedImage from '../media/EncryptedImage'
import { tinyPreviewAt } from '../../utils/mediaThumbs'
import useCloseOnBack from '../../hooks/useCloseOnBack'
import { yearsAgo } from '../../utils/advent'

/**
 * What is behind an opened door, large: the photo, when and where, the
 * words — and the way to the memory or moment itself.
 */
export default function AdventDoorSheet({ door, year, formatDate, onClose, onOpenEntry }) {
  const { t } = useTranslation('advent')
  const close = useCloseOnBack(onClose)
  const { day, entry, onThisDay } = door
  const doc = entry?.doc
  const photo = doc?.images?.[0] || doc?.imageUrl
  const title = doc?.title || doc?.caption || ''
  const greetings = t('greetings', { returnObjects: true })
  const greeting = Array.isArray(greetings) ? greetings[day % greetings.length] : ''

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={t('doorLabel', { day })}
      onClick={close}
    >
      <div
        className="relative w-full sm:max-w-md bg-warm-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center"
          aria-label={t('close')}
        >
          <X className="w-5 h-5" />
        </button>

        {photo ? (
          <div className="relative aspect-[4/3] bg-cream-dark">
            <EncryptedImage
              src={photo}
              tinyPreview={tinyPreviewAt(doc, 0)}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <span className="absolute bottom-3 left-3 rounded-full bg-kaydo text-white text-sm font-bold px-3 py-1 shadow">
              {t('doorLabel', { day })}
            </span>
          </div>
        ) : (
          <div className="h-28 flex items-center justify-center advent-board">
            <span className="font-serif text-4xl font-bold text-white">{day}</span>
          </div>
        )}

        <div className="p-5 space-y-2">
          {entry ? (
            <>
              <p className="text-xs font-semibold tracking-widest uppercase text-kaydo">
                {onThisDay
                  ? t('onThisDay', { count: yearsAgo(entry.date, year) })
                  : t('fromDate', { date: formatDate(entry.date) })}
              </p>
              {title && <h2 className="font-serif text-2xl font-bold text-bark leading-snug">{title}</h2>}
              {doc.content && <p className="text-sm text-bark-light leading-relaxed line-clamp-5">{doc.content}</p>}
              {doc.quote && <p className="font-serif italic text-bark-light"><q>{doc.quote}</q></p>}
              {doc.location && (
                <p className="flex items-center gap-1 text-xs text-bark-muted">
                  <MapPin className="w-3.5 h-3.5" /> {doc.location}
                </p>
              )}
              <button
                type="button"
                onClick={() => onOpenEntry(entry)}
                className="mt-3 w-full rounded-full bg-kaydo hover:bg-kaydo-dark text-white font-semibold py-3 transition-colors"
              >
                {entry.type === 'moment' ? t('openMoment') : t('openMemory')}
              </button>
            </>
          ) : (
            <div className="text-center py-2">
              <Gift className="w-8 h-8 text-kaydo mx-auto mb-2" />
              <h2 className="font-serif text-2xl font-bold text-bark">{t('greetingTitle')}</h2>
              <p className="text-sm text-bark-light mt-1">{greeting}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
