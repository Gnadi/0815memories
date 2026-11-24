import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { POSTER_RATIO, SKY_STYLES } from '../../utils/sky/skyRenderer'
import { PREVIEW_WIDTH } from '../../hooks/useSkyPoster'

/**
 * The pieces of the sky poster editor that the birth sky in a child's journal
 * and the public page share: the preview, the style and the caption.
 */

export const skyInputClass =
  'w-full px-3 py-2 border border-cream-dark rounded-xl text-sm bg-cream focus:outline-none focus:ring-2 focus:ring-kaydo/30'

export const skySectionClass = 'bg-warm-white rounded-2xl p-4 shadow-sm border border-cream-dark space-y-3'

/**
 * The poster preview. `canvasRef` and the rest come from useSkyPoster.
 * `placeholder` ({ src, width, height, alt }) is a finished poster shown until
 * there is a sky to draw, so the page opens on what it makes rather than on
 * an empty frame.
 */
export function SkyPosterPreview({ canvasRef, sky, catalog, catalogError, label, placeholder }) {
  const { t } = useTranslation('sky')
  return (
    // On desktop the poster fills the screen height (capped by the column width)
    // and stays in view while the settings scroll.
    <div className="flex flex-col items-center gap-3 lg:sticky lg:top-[4.5rem] lg:self-start">
      <div className="relative w-full max-w-md lg:max-w-none lg:w-[min(100%,calc((100vh_-_7rem)/1.4142))] rounded-2xl overflow-hidden shadow-lg border border-cream-dark bg-warm-white">
        <canvas
          ref={canvasRef}
          width={PREVIEW_WIDTH}
          height={Math.round(PREVIEW_WIDTH * POSTER_RATIO)}
          className="block w-full h-auto"
          role="img"
          aria-label={label}
        />
        {!sky && placeholder && (
          <img
            src={placeholder.src}
            width={placeholder.width}
            height={placeholder.height}
            alt={placeholder.alt}
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {!sky && (
          <div className={`absolute inset-0 flex justify-center p-8 text-center ${placeholder ? 'items-end' : 'items-center'}`}>
            <p className="text-sm text-bark bg-warm-white/90 rounded-xl px-4 py-3 shadow">
              {catalogError ? t('loadError') : !catalog ? <Loader2 className="w-5 h-5 animate-spin text-kaydo" /> : t('emptyPreview')}
            </p>
          </div>
        )}
      </div>
      <p className="text-[11px] text-bark-muted text-center max-w-md lg:max-w-xl">{t('credits')}</p>
    </div>
  )
}

export function SkyStyleSection({ value, onChange }) {
  const { t } = useTranslation('sky')
  return (
    <section className={skySectionClass}>
      <h2 className="font-semibold text-bark">{t('style.heading')}</h2>
      <div className="grid grid-cols-3 gap-2">
        {Object.keys(SKY_STYLES).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={value === key}
            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border text-xs ${
              value === key ? 'border-kaydo ring-2 ring-kaydo/30 text-bark' : 'border-cream-dark text-bark-muted'
            }`}
          >
            <span
              className="w-8 h-8 rounded-full border-2"
              style={{ background: SKY_STYLES[key].disc, borderColor: SKY_STYLES[key].edge }}
            />
            {t(`style.${key}`)}
          </button>
        ))}
      </div>
    </section>
  )
}

export function SkyCaptionSection({ title, dedication, onChange }) {
  const { t } = useTranslation('sky')
  return (
    <section className={skySectionClass}>
      <h2 className="font-semibold text-bark">{t('caption.heading')}</h2>
      <div>
        <label htmlFor="sky-title" className="block text-xs font-medium text-bark-muted mb-1">
          {t('caption.titleLabel')}
        </label>
        <input
          id="sky-title"
          type="text"
          value={title}
          maxLength={40}
          onChange={(e) => onChange({ title: e.target.value })}
          className={skyInputClass}
        />
      </div>
      <div>
        <label htmlFor="sky-dedication" className="block text-xs font-medium text-bark-muted mb-1">
          {t('caption.dedicationLabel')}
        </label>
        <input
          id="sky-dedication"
          type="text"
          value={dedication}
          maxLength={80}
          placeholder={t('caption.dedicationPlaceholder')}
          onChange={(e) => onChange({ dedication: e.target.value })}
          className={skyInputClass}
        />
      </div>
    </section>
  )
}

/** One export button, busy while its file is made. */
export function SkyExportButton({ kind, busy, disabled, label, busyLabel, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-cream-dark text-sm text-bark hover:bg-cream disabled:opacity-50"
    >
      {busy === kind ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4 text-kaydo" />}
      {busy === kind ? busyLabel : label}
    </button>
  )
}
