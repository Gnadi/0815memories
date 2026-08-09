import { RAIL_BASE, RAIL_VARIANTS } from './galleryLayout'

/**
 * The gallery layout shared by the collage and highlight screens.
 *
 * On a phone it is a swipeable rail: one big card in view with the next one
 * peeking in at the screen edge, which is the whole point — a template is
 * artwork, and a wall of thumbnails is too small to choose from. From `md` up
 * the same markup becomes a grid, because a rail on a wide screen only hides
 * cards off to the right where nobody scrolls.
 *
 * One DOM tree for both, so every card mounts once and no canvas is drawn
 * twice. Give the children `railItemClass(variant)` from `galleryLayout`.
 *
 * `pt-2 pb-6`: a scroll container clips both axes once one of them scrolls, and
 * the cards carry a drop shadow and a hover lift that would be sheared off
 * flush against the edge.
 */
export default function GalleryRail({ variant = 'hero', children }) {
  return <div className={`${RAIL_BASE} ${RAIL_VARIANTS[variant].rail}`}>{children}</div>
}
