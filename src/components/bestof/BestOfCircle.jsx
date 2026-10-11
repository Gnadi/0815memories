import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import EncryptedImage from '../media/EncryptedImage'
import { musicWantedOnDevice, unlockAudio } from '../../utils/audioContext'
import { bestOfLabels } from './bestOfLabels'

/**
 * Last month's best-of, first in the moments row. Its ring turns in the
 * colours of a highlight until this device has watched it — the in-app
 * counterpart of the push on the 1st.
 */
export default function BestOfCircle({ bestOf, seen, onOpen }) {
  const { t, i18n } = useTranslation('bestOf')
  const labels = bestOfLabels(bestOf.month, i18n.language, t)
  return (
    <button
      type="button"
      // The tap that opens the story is the one that lets its music play.
      onClick={() => {
        if (musicWantedOnDevice()) unlockAudio()
        onOpen()
      }}
      className="flex flex-col items-center gap-1.5 flex-shrink-0"
      aria-label={t('row.open', { month: labels.monthYear })}
      data-testid="bestof-circle"
    >
      <div className="relative w-[4.5rem] h-[4.5rem]">
        <div className="relative w-full h-full rounded-full p-[3px] overflow-hidden">
          <span
            aria-hidden="true"
            className={`absolute inset-[-50%] ${seen ? 'bg-cream-dark' : 'animate-[spin_6s_linear_infinite] motion-reduce:animate-none'}`}
            style={seen ? undefined : { background: 'conic-gradient(#f59e0b, #C25A2E, #ec4899, #8b5cf6, #f59e0b)' }}
          />
          <div className="relative w-full h-full rounded-full bg-cream p-[2px]">
            <div className="relative w-full h-full rounded-full overflow-hidden bg-[#141a2e]">
              {bestOf.cover && (
                <EncryptedImage
                  src={bestOf.cover.url}
                  thumbSrc={bestOf.cover.thumbUrl || ''}
                  tinyPreview={bestOf.cover.tiny || ''}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <span className="absolute inset-x-0 bottom-1.5 text-center text-[10px] font-black uppercase tracking-wide text-white leading-none">
                {labels.monthShort}
              </span>
            </div>
          </div>
        </div>
        <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-amber-400 text-white flex items-center justify-center shadow ring-2 ring-cream">
          <Sparkles className="w-3 h-3" aria-hidden="true" />
        </span>
      </div>
      <span className="text-xs font-semibold text-bark max-w-[76px] truncate">{labels.circle}</span>
    </button>
  )
}
