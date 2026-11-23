import { useTranslation } from 'react-i18next'

// The logo's strokes (KaydoLogo.jsx), each with its place in the drawing order.
const STROKES = [
  { d: 'M 50 6 L 6 38', color: '#C25A2E', width: 7.5 },
  { d: 'M 6 38 L 6 92', color: '#C25A2E', width: 7.5 },
  { d: 'M 6 63 L 36 38', color: '#C25A2E', width: 6.5 },
  { d: 'M 6 63 L 43 92', color: '#C25A2E', width: 6.5 },
  { d: 'M 34 92 L 34 57 Q 34 10 60 10 Q 91 10 91 56 L 91 92', color: '#8B9E7E', width: 6.5 },
]

/**
 * What a family member sees between "Enter" and their home, and on a reload
 * of the app while the session and the family's key are restored.
 *
 * It used to be a bare spinner. The wait is the key being fetched and the
 * first memories decrypted, so it is shown as what it is in Kaydo's own
 * terms: the house of the logo is drawn and its doorway lights up.
 */
export default function UnlockScreen() {
  const { t } = useTranslation('common')
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center" role="status">
      <div className="kaydo-unlock flex flex-col items-center gap-5">
        <svg width="72" height="72" viewBox="0 0 100 100" aria-hidden="true">
          {/* The doorway, inside the arch */}
          <path
            className="kaydo-unlock-door"
            d="M 34 92 L 34 57 Q 34 10 60 10 Q 91 10 91 56 L 91 92 Z"
            fill="#F2C48D"
          />
          {STROKES.map((s, i) => (
            <path
              key={s.d}
              className="kaydo-unlock-stroke"
              style={{ '--i': i }}
              d={s.d}
              pathLength="1"
              stroke={s.color}
              strokeWidth={s.width}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          <circle className="kaydo-unlock-dot" cx="60" cy="36" r="6.5" fill="#F5E6C8" />
        </svg>
        <p className="kaydo-unlock-text text-sm text-bark-light">{t('unlocking')}</p>
      </div>
    </div>
  )
}
