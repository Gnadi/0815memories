import { STAGE_CAP, stageWidthFor } from './galleryLayout'

/**
 * The stage a gallery card's artwork stands on: a fixed 4:5 box, with the
 * artwork sized inside it from its own aspect ratio (see `stageWidthFor`).
 * Every card in a rail therefore lines up on both axes, whatever shape the
 * collage is.
 *
 * `children` fills the inner box with `w-full h-full` — a CollagePreview, a
 * photo mosaic, a poster, a dashed placeholder; the stage neither knows nor
 * cares which. `size="list"` is the smaller stage used for saved work, where
 * the customer is browsing rather than choosing.
 */
export default function GalleryStage({ ratio, size = 'hero', className = '', children }) {
  return (
    <div className={`w-full ${STAGE_CAP[size]} mx-auto aspect-[4/5] flex items-center justify-center`}>
      <div className={className} style={{ width: stageWidthFor(ratio), aspectRatio: String(ratio) }}>
        {children}
      </div>
    </div>
  )
}
