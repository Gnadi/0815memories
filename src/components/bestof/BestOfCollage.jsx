import { useEffect } from 'react'
import useMediaQuery from '../../hooks/useMediaQuery'
import { BottomShade, Caption, PhotoSlide, SlideImage } from './BestOfSlides'
import { Montage } from './BestOfMontage'

/**
 * A slide of several photos at once, in the layout utils/bestOf.js chose, and
 * set in motion: the tiles make their entrance, and then the photos keep
 * moving slowly until the story moves on. All of the motion is CSS
 * (bestOf.css), so holding the story holds it too, and the browser does it
 * without any work here once the slide is mounted.
 */

// The photos each layout is made for, fewest and most. A collage can still
// arrive with fewer than its layout wants — one saved by another version, say
// — and then it takes the layout that fits rather than show a gap.
const LAYOUT_SIZES = {
  duo: [2, 2],
  trio: [3, 3],
  grid: [4, 4],
  polaroids: [3, 4],
  strip: [3, 4],
  mosaic: [3, 4],
  diagonal: [2, 3],
  pinboard: [3, 4],
  montage: [3, 4],
}

// The strip is the one layout whose photos only come into view by moving, so
// for someone who asked for less motion it becomes a still one.
function fittingLayout(layout, count, still) {
  if (layout === 'strip' && still) layout = null
  if (count >= (LAYOUT_SIZES[layout]?.[0] ?? Infinity)) return layout
  if (count >= 4) return 'grid'
  if (count === 3) return 'trio'
  if (count === 2) return 'duo'
  return 'single'
}

// Where the tiles sit, in percent of the slide, how each arrives and how its
// photo moves on afterwards. The slide is 9:16, so 2% across is about as wide
// as 1.2% down. The bottom tiles run under the caption, which brings its own
// shade, as a photo slide's picture does.
const DUO = [
  { left: 3, top: 4, width: 94, height: 45, enter: 'bestof-tile-left', motion: 'bestof-motion-panRight' },
  { left: 3, top: 51, width: 94, height: 45, enter: 'bestof-tile-right', delay: 0.25, motion: 'bestof-motion-panLeft' },
]

// The drifts start at different points of their swing, so that the three
// photos do not move in step.
const TRIO = [
  { left: 3, top: 4, width: 94, height: 56, enter: 'bestof-tile-pop', motion: 'bestof-tile-drift' },
  { left: 3, top: 61.5, width: 46, height: 34.5, enter: 'bestof-tile-pop', delay: 0.3, motion: 'bestof-tile-drift', drift: -2.5 },
  { left: 51, top: 61.5, width: 46, height: 34.5, enter: 'bestof-tile-pop', delay: 0.6, motion: 'bestof-tile-drift', drift: -5 },
]

// Wider margins than the others: the grid zooms in as a whole, and at 3% its
// outer tiles would end up against the edges of the slide.
const GRID = [
  { left: 4, top: 5, width: 45, height: 44.4, enter: 'bestof-tile-pop' },
  { left: 51, top: 5, width: 45, height: 44.4, enter: 'bestof-tile-pop', delay: 0.2 },
  { left: 4, top: 50.6, width: 45, height: 44.4, enter: 'bestof-tile-pop', delay: 0.4 },
  { left: 51, top: 50.6, width: 45, height: 44.4, enter: 'bestof-tile-pop', delay: 0.6 },
]

// One big photo and the others beside it, or under it: a magazine's page.
const MOSAIC = {
  3: [
    { left: 3, top: 4, width: 57, height: 92, enter: 'bestof-tile-left', motion: 'bestof-motion-panUp' },
    { left: 62, top: 4, width: 35, height: 45, enter: 'bestof-tile-right', delay: 0.25, motion: 'bestof-tile-drift' },
    { left: 62, top: 51, width: 35, height: 45, enter: 'bestof-tile-right', delay: 0.45, motion: 'bestof-tile-drift', drift: -3 },
  ],
  4: [
    { left: 3, top: 4, width: 94, height: 50, enter: 'bestof-tile-pop', motion: 'bestof-motion-zoomIn' },
    { left: 3, top: 55.5, width: 30, height: 40.5, enter: 'bestof-tile-pop', delay: 0.3, motion: 'bestof-tile-drift' },
    { left: 35, top: 55.5, width: 30, height: 40.5, enter: 'bestof-tile-pop', delay: 0.45, motion: 'bestof-tile-drift', drift: -2 },
    { left: 67, top: 55.5, width: 30, height: 40.5, enter: 'bestof-tile-pop', delay: 0.6, motion: 'bestof-tile-drift', drift: -4 },
  ],
}

// Bands across the whole slide, cut on a slant. Every band is as large as the
// slide and shows only its own share, so each photo is framed as if it filled
// it, and the slanted gaps between them are the background.
const DIAGONAL = {
  2: [
    { left: 0, top: 0, width: 100, height: 100, enter: 'bestof-tile-left', motion: 'bestof-motion-panRight', clip: 'polygon(0 0, 100% 0, 100% 41%, 0 57%)' },
    { left: 0, top: 0, width: 100, height: 100, enter: 'bestof-tile-right', delay: 0.25, motion: 'bestof-motion-panLeft', clip: 'polygon(0 59%, 100% 43%, 100% 100%, 0 100%)' },
  ],
  3: [
    { left: 0, top: 0, width: 100, height: 100, enter: 'bestof-tile-left', motion: 'bestof-motion-panRight', clip: 'polygon(0 0, 100% 0, 100% 26%, 0 38%)' },
    { left: 0, top: 0, width: 100, height: 100, enter: 'bestof-tile-right', delay: 0.25, motion: 'bestof-motion-panLeft', clip: 'polygon(0 40%, 100% 28%, 100% 62%, 0 74%)' },
    { left: 0, top: 0, width: 100, height: 100, enter: 'bestof-tile-left', delay: 0.5, motion: 'bestof-motion-panRight', clip: 'polygon(0 76%, 100% 64%, 100% 100%, 0 100%)' },
  ],
}

// One photo in its frame. The frame makes the entrance and the photo inside
// it the slow move: both are transforms, and on one element the second
// animation would replace the first. `isolate`, because Safari otherwise lets
// a moving photo spill past the rounded corners.
function Tile({ spot, media, rounded, onReady }) {
  return (
    <div
      data-testid="bestof-tile"
      className={`absolute isolate overflow-hidden ${spot.clip ? '' : `shadow-xl ${rounded}`} ${spot.enter || ''}`}
      style={{
        left: `${spot.left}%`,
        top: `${spot.top}%`,
        width: `${spot.width}%`,
        height: `${spot.height}%`,
        animationDelay: spot.delay ? `${spot.delay}s` : undefined,
        clipPath: spot.clip,
      }}
    >
      <div
        className={`absolute inset-0 ${spot.motion || ''}`}
        style={spot.drift ? { animationDelay: `${spot.drift}s` } : undefined}
      >
        <SlideImage media={media} onReady={onReady} />
      </div>
    </div>
  )
}

// The slide's clock waits for the first photo only: once that is in, there is
// something to look at, and the others follow in their own time.
function Tiles({ spots, photos, rounded = 'rounded-3xl', onReady }) {
  return photos.map((media, i) => (
    <Tile key={i} spot={spots[i]} media={media} rounded={rounded} onReady={i === 0 ? onReady : undefined} />
  ))
}

// Prints dropped onto the middle one after another, each at its own angle,
// over the first photo blurred into the table they land on. Each sways from
// its own point of the swing, so that they do not rock in step.
const POLAROIDS = {
  3: [
    { left: 5, top: 14, tilt: -8, delay: 0, sway: 0 },
    { left: 48, top: 23, tilt: 6, delay: 0.3, sway: -1.7 },
    { left: 24, top: 43, tilt: -3, delay: 0.6, sway: -3.4 },
  ],
  4: [
    { left: 5, top: 12, tilt: -8, delay: 0, sway: 0 },
    { left: 48, top: 18, tilt: 6, delay: 0.3, sway: -1.7 },
    { left: 8, top: 41, tilt: -3, delay: 0.6, sway: -3.4 },
    { left: 46, top: 47, tilt: 9, delay: 0.9, sway: -5.1 },
  ],
}

function Polaroids({ photos, onReady }) {
  return (
    <>
      {/* Enlarged, so the blur's soft edges fall outside the slide. */}
      <div className="absolute inset-0 scale-[1.2]">
        <SlideImage media={photos[0]} style={{ filter: 'blur(24px) brightness(0.5)' }} />
      </div>
      {POLAROIDS[photos.length].map((card, i) => (
        <div
          key={i}
          data-testid="bestof-tile"
          className="bestof-tile-drop absolute w-[46%]"
          style={{
            left: `${card.left}%`,
            top: `${card.top}%`,
            '--bestof-tilt': `${card.tilt}deg`,
            animationDelay: `${card.delay}s`,
          }}
        >
          <div
            className="bestof-sway rounded-sm bg-warm-white p-[6%] pb-[22%] shadow-2xl"
            style={{ animationDelay: `${card.sway}s` }}
          >
            <div className="relative aspect-square overflow-hidden bg-cream-dark">
              <SlideImage media={photos[i]} onReady={i === 0 ? onReady : undefined} />
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

// Prints pinned to a board with a strip of tape each, nearly straight: a
// diary's page rather than a table. They pop up one after another.
const PINBOARD = {
  3: [
    { left: 6, top: 11, width: 50, tilt: -3, delay: 0 },
    { left: 46, top: 27, width: 48, tilt: 4, delay: 0.3 },
    { left: 12, top: 50, width: 52, tilt: -2, delay: 0.6 },
  ],
  4: [
    { left: 5, top: 10, width: 46, tilt: -4, delay: 0 },
    { left: 50, top: 13, width: 45, tilt: 3, delay: 0.25 },
    { left: 8, top: 44, width: 44, tilt: 2, delay: 0.5 },
    { left: 49, top: 47, width: 46, tilt: -3, delay: 0.75 },
  ],
}

function Pinboard({ photos, onReady }) {
  return (
    <div className="bestof-board absolute inset-0 bg-[var(--bo-light-2)]">
      {PINBOARD[photos.length].map((card, i) => (
        <div
          key={i}
          data-testid="bestof-tile"
          className="bestof-tile-pop absolute"
          style={{ left: `${card.left}%`, top: `${card.top}%`, width: `${card.width}%`, animationDelay: `${card.delay}s` }}
        >
          <div className="relative bg-warm-white p-[4%] shadow-xl" style={{ rotate: `${card.tilt}deg` }}>
            <div className="relative aspect-[4/5] overflow-hidden bg-cream-dark">
              <SlideImage media={photos[i]} onReady={i === 0 ? onReady : undefined} />
            </div>
            <span
              aria-hidden="true"
              className="absolute left-1/2 -top-3 h-6 w-[38%] -translate-x-1/2 bg-white/60 shadow-sm"
              style={{ rotate: `${-card.tilt * 1.5}deg` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// A film strip running right to left. Its frames are wider than half the
// slide, so it has to travel for every photo to pass through: from the first
// frame in the middle to the last. The track is as wide as the slide, which
// makes that distance a share of the slide's width, as the CSS needs it.
const STRIP = { first: 15, width: 70, step: 74 }

function Strip({ photos, onReady }) {
  const travel = (photos.length - 1) * STRIP.step
  const spots = photos.map((_, i) => ({ left: STRIP.first + i * STRIP.step, top: 10, width: STRIP.width, height: 80 }))
  return (
    <div className="bestof-strip absolute inset-x-0 top-[13%] h-[69%]" style={{ '--bestof-travel': `${travel}%` }}>
      {/* The film runs on past both ends, so its ends never come into view. */}
      <div className="bestof-sprockets absolute inset-y-0 -left-full bg-black/40" style={{ width: `${travel + 300}%` }} />
      <Tiles spots={spots} photos={photos} rounded="rounded-lg" onReady={onReady} />
    </div>
  )
}

export function CollageSlide({ slide, labels, look, beatMs, slideMs, onReady }) {
  const all = Array.isArray(slide.media) ? slide.media.filter(Boolean) : []
  const empty = all.length === 0
  const still = useMediaQuery('(prefers-reduced-motion: reduce)')

  // With no photo there is nothing to wait for.
  useEffect(() => {
    if (empty) onReady?.()
  }, [empty, onReady])

  const layout = empty ? null : fittingLayout(slide.layout, all.length, still)
  if (layout === 'single') {
    return <PhotoSlide slide={{ ...slide, media: all[0], motion: 'zoomIn' }} labels={labels} look={look} onReady={onReady} />
  }
  const photos = layout ? all.slice(0, LAYOUT_SIZES[layout][1]) : []

  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--bo-dark)]" data-layout={layout || 'empty'}>
      {layout === 'duo' && <Tiles spots={DUO} photos={photos} onReady={onReady} />}
      {layout === 'trio' && <Tiles spots={TRIO} photos={photos} onReady={onReady} />}
      {layout === 'grid' && (
        // A camera tour of the grid over the slide's time — the whole of it,
        // then each photo close up in turn, then the whole again — or, without
        // the time or with less motion asked for, a slow push in.
        <div
          className={`${slideMs && !still ? 'bestof-grid-tour' : 'bestof-grid-zoom'} absolute inset-0`}
          style={slideMs && !still ? { animationDuration: `${slideMs}ms` } : undefined}
        >
          <Tiles spots={GRID} photos={photos} rounded="rounded-2xl" onReady={onReady} />
        </div>
      )}
      {layout === 'polaroids' && <Polaroids photos={photos} onReady={onReady} />}
      {layout === 'strip' && <Strip photos={photos} onReady={onReady} />}
      {layout === 'mosaic' && <Tiles spots={MOSAIC[photos.length]} photos={photos} rounded="rounded-2xl" onReady={onReady} />}
      {layout === 'diagonal' && <Tiles spots={DIAGONAL[photos.length]} photos={photos} onReady={onReady} />}
      {layout === 'pinboard' && <Pinboard photos={photos} onReady={onReady} />}
      {layout === 'montage' && <Montage photos={photos} beatMs={beatMs} onReady={onReady} />}
      <BottomShade />
      <Caption caption={slide.caption} meta={labels.meta(slide)} look={look} />
    </div>
  )
}
