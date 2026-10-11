import { useEffect } from 'react'
import { BottomShade, Caption, PhotoSlide, SlideImage } from './BestOfSlides'

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
}

function fittingLayout(layout, count) {
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

// One photo in its frame. The frame makes the entrance and the photo inside
// it the slow move: both are transforms, and on one element the second
// animation would replace the first. `isolate`, because Safari otherwise lets
// a moving photo spill past the rounded corners.
function Tile({ spot, media, rounded, onReady }) {
  return (
    <div
      data-testid="bestof-tile"
      className={`absolute isolate overflow-hidden shadow-xl ${rounded} ${spot.enter || ''}`}
      style={{
        left: `${spot.left}%`,
        top: `${spot.top}%`,
        width: `${spot.width}%`,
        height: `${spot.height}%`,
        animationDelay: spot.delay ? `${spot.delay}s` : undefined,
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

export function CollageSlide({ slide, labels, onReady }) {
  const all = Array.isArray(slide.media) ? slide.media.filter(Boolean) : []
  const empty = all.length === 0

  // With no photo there is nothing to wait for.
  useEffect(() => {
    if (empty) onReady?.()
  }, [empty, onReady])

  const layout = empty ? null : fittingLayout(slide.layout, all.length)
  if (layout === 'single') {
    return <PhotoSlide slide={{ ...slide, media: all[0], motion: 'zoomIn' }} labels={labels} onReady={onReady} />
  }
  const photos = layout ? all.slice(0, LAYOUT_SIZES[layout][1]) : []

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#141a2e]" data-layout={layout || 'empty'}>
      {layout === 'duo' && <Tiles spots={DUO} photos={photos} onReady={onReady} />}
      {layout === 'trio' && <Tiles spots={TRIO} photos={photos} onReady={onReady} />}
      {layout === 'grid' && (
        <div className="bestof-grid-zoom absolute inset-0">
          <Tiles spots={GRID} photos={photos} rounded="rounded-2xl" onReady={onReady} />
        </div>
      )}
      {layout === 'polaroids' && <Polaroids photos={photos} onReady={onReady} />}
      {layout === 'strip' && <Strip photos={photos} onReady={onReady} />}
      <BottomShade />
      <Caption caption={slide.caption} meta={labels.meta(slide)} />
    </div>
  )
}
