import { useTranslation } from 'react-i18next'
import { Star } from 'lucide-react'
import useCloseOnBack from '../../hooks/useCloseOnBack'

// Stars and flakes for the shower, laid out once: position, delay, size and
// drift, so that the fall looks scattered without random numbers in render.
const PIECES = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 13) % 30) / 10,
  size: 8 + ((i * 7) % 4) * 4,
  drift: ((i * 11) % 7) * 10 - 30,
  kind: i % 3,
}))

/**
 * What comes when the last of the 24 doors has been opened: a shower of gold
 * over the calendar and a Christmas greeting. Shown once, when it happens;
 * the calendar stays as it is behind it.
 */
export default function AdventFinale({ onClose }) {
  const { t } = useTranslation('advent')
  const close = useCloseOnBack(onClose)

  return (
    <div
      className="advent-finale fixed inset-0 z-50 flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="advent-finale-title"
      onClick={close}
    >
      <div className="advent-finale__shower" aria-hidden="true">
        {PIECES.map((piece, i) => (
          <span
            key={i}
            className={`advent-finale__piece advent-finale__piece--${piece.kind}`}
            style={{
              left: `${piece.left}%`,
              width: piece.size,
              height: piece.size,
              animationDelay: `${piece.delay}s`,
              '--drift': `${piece.drift}px`,
            }}
          />
        ))}
      </div>

      <div className="advent-finale__card relative max-w-sm w-full rounded-3xl px-6 py-8 text-center" onClick={(e) => e.stopPropagation()}>
        <Star className="mx-auto w-12 h-12 text-[#e9c77b] fill-[#e9c77b] advent-finale__star" aria-hidden="true" />
        <h2 id="advent-finale-title" className="mt-4 font-serif text-3xl font-bold text-[#fff3d6]">{t('finale.title')}</h2>
        <p className="mt-3 text-sm leading-relaxed text-white/85">{t('finale.body')}</p>
        <button
          type="button"
          onClick={close}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-[#e9c77b] px-6 py-2.5 text-sm font-bold text-[#5a2a08] shadow-lg active:scale-95 transition-transform"
        >
          {t('finale.close')}
        </button>
      </div>
    </div>
  )
}
