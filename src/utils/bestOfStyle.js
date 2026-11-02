/**
 * The styles a best-of can be told in, one per month in turn, so that the
 * story of October does not look like the story of September. A style here is
 * what the composition needs to know (utils/bestOf.js): which camera moves its
 * photos make, which collages its moments become, and how the story is put in
 * order. How it looks — its colours, its opening card, its transitions — is
 * the viewer's business (components/bestof/bestOfLooks.js), under the same id.
 *
 * Pure and without imports, so that both sides can use it.
 */

/**
 * Seven of them. Seven does not go into twelve, so the same month a year later
 * has a different style; and the eight tracks of utils/bestOfMusic.js go round
 * at their own pace, so a style comes back with other music.
 */
export const STYLE_ORDER = ['polaroid', 'cinema', 'magazine', 'festival', 'diary', 'mosaic', 'minimal']

// Each style's camera moves are a selection of these, in its own order
// (bestOf.css has one animation for each).
export const MOTIONS = ['zoomIn', 'panLeft', 'zoomOut', 'panRight', 'panUp', 'panDown', 'diagonal', 'tilt']

/**
 * The collages each size of beat may become, in turn, and the camera moves of
 * single photos, in turn. Every size of three or four has at least two
 * layouts, so two collages in a row need not look alike.
 */
export const STYLES = {
  // The look the best-of had before it had styles, for one saved without.
  classic: {
    motions: ['zoomIn', 'panLeft', 'zoomOut', 'panRight', 'panUp'],
    layouts: { 2: ['duo'], 3: ['trio', 'polaroids', 'strip'], 4: ['grid', 'polaroids', 'strip'] },
  },
  polaroid: {
    motions: ['zoomIn', 'panLeft', 'tilt', 'panRight', 'zoomOut'],
    layouts: { 2: ['duo'], 3: ['polaroids', 'pinboard', 'trio'], 4: ['polaroids', 'pinboard', 'grid'] },
  },
  cinema: {
    motions: ['panLeft', 'panRight', 'zoomIn', 'diagonal', 'panUp'],
    layouts: { 2: ['duo', 'diagonal'], 3: ['strip', 'trio'], 4: ['strip', 'grid'] },
  },
  magazine: {
    motions: ['zoomOut', 'panUp', 'zoomIn', 'panLeft', 'panDown'],
    layouts: { 2: ['diagonal', 'duo'], 3: ['mosaic', 'trio'], 4: ['mosaic', 'grid'] },
  },
  festival: {
    motions: ['zoomIn', 'tilt', 'panRight', 'zoomOut', 'panLeft', 'diagonal'],
    layouts: { 2: ['duo', 'diagonal'], 3: ['trio', 'polaroids', 'mosaic'], 4: ['grid', 'polaroids', 'mosaic'] },
  },
  diary: {
    motions: ['panRight', 'zoomIn', 'panDown', 'panLeft'],
    layouts: { 2: ['duo'], 3: ['pinboard', 'polaroids'], 4: ['pinboard', 'polaroids'] },
  },
  mosaic: {
    motions: ['zoomIn', 'diagonal', 'zoomOut', 'panLeft'],
    layouts: { 2: ['diagonal'], 3: ['mosaic', 'trio'], 4: ['mosaic', 'grid'] },
  },
  minimal: {
    motions: ['zoomIn', 'zoomOut'],
    layouts: { 2: ['duo'], 3: ['trio', 'mosaic'], 4: ['grid', 'mosaic'] },
  },
}

/** The style for the `index`th month since the year 0, in turn. */
export function styleAt(index) {
  const n = STYLE_ORDER.length
  return STYLE_ORDER[((index % n) + n) % n]
}

/** A style's settings; the classic ones for an id this version does not know. */
export function styleOf(id) {
  return STYLES[id] || STYLES.classic
}
