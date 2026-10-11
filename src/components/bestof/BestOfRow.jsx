import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import EncryptedImage from '../media/EncryptedImage'
import { unlockAudio } from '../../utils/audioContext'
import { bestOfLabels } from './bestOfLabels'

/**
 * Every saved best-of, newest month first, above the moments grid — the place
 * to watch an earlier month again once the row on the home page has moved on.
 */
export default function BestOfRow({ bestOfs, onOpen }) {
  const { t, i18n } = useTranslation('bestOf')
  if (!bestOfs.length) return null
  return (
    <section className="px-3 pt-4" aria-labelledby="bestof-row-title">
      <h2 id="bestof-row-title" className="flex items-center gap-1.5 px-1 mb-3 text-sm font-bold text-bark">
        <Sparkles className="w-4 h-4 text-amber-500" aria-hidden="true" />
        {t('row.title')}
      </h2>
      <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
        {bestOfs.map(({ month, doc }) => {
          const labels = bestOfLabels(month, i18n.language, t)
          return (
            <button
              key={month}
              type="button"
              // The tap that opens the story is the one that lets its music play.
              onClick={() => {
                unlockAudio()
                onOpen(month)
              }}
              className="relative flex-shrink-0 w-32 aspect-[9/16] rounded-2xl overflow-hidden bg-[#141a2e] group"
              aria-label={t('row.open', { month: labels.monthYear })}
            >
              {doc.cover && (
                <EncryptedImage
                  src={doc.cover.url}
                  thumbSrc={doc.cover.thumbUrl || ''}
                  tinyPreview={doc.cover.tiny || ''}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              )}
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />
              <Sparkles className="absolute top-2.5 left-2.5 w-4 h-4 text-amber-300 drop-shadow" aria-hidden="true" />
              {/* At the bottom, clear of the faces the cover is usually chosen for. */}
              <span className="absolute inset-x-0 bottom-0 px-2.5 pb-2.5 text-left pointer-events-none">
                <span className="block font-display text-3xl uppercase leading-none text-white drop-shadow">
                  {labels.monthShort}
                </span>
                <span className="block mt-1 text-white/80 text-[10px] font-semibold tracking-widest">{labels.year}</span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
