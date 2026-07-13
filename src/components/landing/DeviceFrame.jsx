/**
 * Presentational device frames for the landing page. They wrap real app
 * screenshots so visitors immediately read them as "this is the actual product".
 * Purely decorative — no state beyond the active language.
 */
import { useTranslation } from 'react-i18next'

/**
 * A minimal browser-window chrome around a desktop screenshot.
 * Pass `priority` for an above-the-fold image (the hero) so it loads eagerly
 * with high fetch priority — it is usually the Largest Contentful Paint element.
 */
export function BrowserFrame({ src, alt, width, height, className = '', priority = false }) {
  // Locale-specific demo family (en: Bennetts, de: Mustermanns), same URL as
  // the landing page's demo CTAs.
  const { t } = useTranslation('landing')
  const demoUrl = t('hero.demoUrl')
  const demoLabel = demoUrl.replace(/^https?:\/\//, '')
  return (
    <figure className={`rounded-2xl overflow-hidden shadow-2xl border border-cream-dark bg-white ${className}`}>
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-cream-dark/70 border-b border-cream-dark">
        <span className="w-3 h-3 rounded-full bg-red-400" />
        <span className="w-3 h-3 rounded-full bg-amber-400" />
        <span className="w-3 h-3 rounded-full bg-green-400" />
        {/* The address bar doubles as a link to the live demo family. */}
        <a
          href={demoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-3 flex-1 max-w-xs h-5 rounded-md bg-white/70 flex items-center px-2.5 hover:bg-white transition-colors"
        >
          <span className="text-[10px] text-bark-muted truncate">{demoLabel}</span>
        </a>
      </div>
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className="block w-full h-auto"
      />
    </figure>
  )
}

/** A phone bezel around a mobile screenshot. */
export function PhoneFrame({ src, alt, width, height, className = '' }) {
  return (
    <figure className={`relative mx-auto w-full max-w-[260px] rounded-[2.5rem] bg-bark p-2.5 shadow-2xl ${className}`}>
      {/* Notch */}
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-5 bg-bark rounded-b-2xl z-10" />
      <div className="rounded-[2rem] overflow-hidden bg-white">
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading="lazy"
          className="block w-full h-auto"
        />
      </div>
    </figure>
  )
}
