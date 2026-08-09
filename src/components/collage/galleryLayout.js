// The measurements the collage and highlight galleries share.
//
// Both screens are the same screen with different contents — a picker of large
// artwork above, the family's saved work below — so the card sizing, the rail
// geometry and the interaction affordances live here rather than being typed
// out four times and drifting apart.

import { ASPECTS, DEFAULT_ASPECT } from './collageTemplates'

// Every card stands on a 4:5 stage — the shape eleven of the fourteen
// templates already are — and the artwork fills it as far as its own ratio
// allows. Cards then line up on both axes without a square-ish crop
// misrepresenting a portrait template on the very screen where the customer
// picks a shape.
export const REFERENCE_RATIO = ASPECTS[DEFAULT_ASPECT]

/**
 * How wide a collage of `ratio` (width / height) must be to fill the stage.
 *
 * Anything at least as wide as the reference fills the stage's width and sits
 * short of its height; anything narrower (a 9:16 story) fills the height and
 * gives width back. Returned as a percentage so the box has exactly one
 * definite dimension and takes the other from `aspect-ratio` — never two, which
 * is what a `max-width` clamp would leave it with, and a clamped box makes
 * `drawCollage` paint the slots stretched.
 */
export function stageWidthFor(ratio) {
  const r = Number(ratio) || REFERENCE_RATIO
  return r >= REFERENCE_RATIO ? '100%' : `${((r / REFERENCE_RATIO) * 100).toFixed(2)}%`
}

// Capped against the viewport height as well as the column, so a phone held
// sideways shows a whole card instead of a sliver of one.
export const STAGE_CAP = {
  hero: 'max-w-[min(100%,50vh)]',
  list: 'max-w-[min(100%,34vh)]',
}

export const RAIL_BASE = `flex overflow-x-auto hide-scrollbar snap-x snap-mandatory motion-safe:scroll-smooth
  scroll-px-4 sm:scroll-px-6 -mx-4 px-4 sm:-mx-6 sm:px-6 pt-2 pb-6
  md:mx-0 md:px-0 md:pb-2 md:grid md:overflow-visible md:snap-none`

export const RAIL_VARIANTS = {
  // The picker: big cards, two columns before three, so a card never shrinks
  // back to thumbnail size beside the w-56 sidebar.
  hero: { rail: 'gap-4 md:gap-8 md:grid-cols-2 xl:grid-cols-3', basis: 'basis-[82%] max-w-[26rem]' },
  // Saved work: browsing, not choosing — narrower cards, more per row.
  list: { rail: 'gap-4 md:gap-6 md:grid-cols-3 xl:grid-cols-4', basis: 'basis-[62%] max-w-[18rem]' },
}

/**
 * Classes for one card in the rail. Put them on the card's own element (the
 * button, or the wrapper carrying a delete overlay) so it is the flex item on a
 * phone and the grid item on a desktop.
 *
 * `snap-start` rather than `snap-center`: the first card can never reach the
 * centre of the viewport, so centre-snapping leaves it stuck against the left
 * while every later card jumps. Start-snapping, paired with the rail's
 * `scroll-px-*` matching its own padding, lands each card exactly on the
 * content edge. `max-w` is dropped at `md` because grid honours it and it would
 * otherwise cap the columns.
 *
 * `min-w-0` is load-bearing: a flex item's automatic minimum size is its
 * content's, which here is the card's own max width — without it the basis is
 * silently ignored and every card comes out the same size, peek and all.
 */
export function railItemClass(variant = 'hero') {
  return `shrink-0 min-w-0 snap-start snap-always ${RAIL_VARIANTS[variant].basis} md:basis-auto md:max-w-none`
}

// The lift on hover, the press on tap — motion-safe, so a customer who asked
// the system for less movement gets a still page.
export const CARD_MOTION =
  'motion-safe:transition-transform motion-safe:hover:-translate-y-1 motion-safe:active:scale-[0.98]'
export const CARD_FOCUS =
  'rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-kaydo'
