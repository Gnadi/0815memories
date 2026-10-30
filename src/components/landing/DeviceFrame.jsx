/**
 * Presentational device frames for the landing page. They wrap real app
 * screenshots so visitors immediately read them as "this is the actual product".
 * Purely decorative — no state, no app dependencies.
 */

/**
 * A minimal browser-window chrome around a desktop screenshot.
 * Pass `priority` for an above-the-fold image (the hero) so it loads eagerly
 * with high fetch priority — it is usually the Largest Contentful Paint element.
 *
 * Pass `fill` for a frame at the foot of a card that shares its row with a
 * taller one: from two columns up it grows into the space the card has left
 * and shows as much of the screenshot as fits, from the top left, instead of
 * leaving a gap above itself. The screenshot should be taller than usual, so
 * there is something to show. In one column the card has no neighbour, and
 * the frame shows the top of it in the shape of the other desktop shots.
 */
export function BrowserFrame({ src, srcSet, sizes, alt, width, height, className = '', priority = false, fill = false }) {
  return (
    <figure className={`rounded-2xl overflow-hidden shadow-2xl border border-cream-dark bg-white ${fill ? 'flex flex-col md:flex-1' : ''} ${className}`}>
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-cream-dark/70 border-b border-cream-dark">
        <span className="w-3 h-3 rounded-full bg-red-400" />
        <span className="w-3 h-3 rounded-full bg-amber-400" />
        <span className="w-3 h-3 rounded-full bg-green-400" />
        {/* The address bar doubles as a link to the demo family. */}
        <a
          href="/demo"
          className="ml-3 flex-1 max-w-xs h-5 rounded-md bg-white/70 flex items-center px-2.5 hover:bg-white transition-colors"
        >
          <span className="text-[10px] text-bark-muted truncate">kaydo.app/demo</span>
        </a>
      </div>
      <div className={fill ? 'relative aspect-[8/5] md:aspect-auto md:flex-1 md:min-h-[16rem]' : undefined}>
        <img
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className={fill ? 'absolute inset-0 w-full h-full object-cover object-left-top' : 'block w-full h-auto'}
        />
      </div>
    </figure>
  )
}

/**
 * A phone bezel around a mobile screenshot.
 *
 * The screen starts with a status bar the notch sits in, as on a real phone;
 * without it the notch covered the top of the picture, where the app puts its
 * title. `statusBar` is its colour, the colour along the screenshot's top edge.
 */
export function PhoneFrame({ src, alt, width, height, className = '', statusBar = 'var(--color-cream)' }) {
  return (
    <figure className={`relative mx-auto w-full max-w-[260px] rounded-[2.5rem] bg-bark p-2.5 shadow-2xl ${className}`}>
      {/* Notch */}
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-5 bg-bark rounded-b-2xl z-10" />
      <div className="rounded-[2rem] overflow-hidden" style={{ backgroundColor: statusBar }}>
        <div className="h-6" aria-hidden="true" />
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
