import { MOTIONS } from '../../utils/bestOfStyle'

/**
 * How each style of utils/bestOfStyle.js looks: its colours, its opening and
 * closing cards, the cuts from one slide to the next, how its words move
 * (`text`, KineticText.jsx), the film it is shot on (`texture`: grain, a
 * vignette, light leaks, a flicker) and what else it lays over the story — a
 * film's black bars, a diary's paper, confetti for an award.
 *
 * The colours are CSS custom properties set on the stage (see `lookVars`), so
 * the slides draw with var(--bo-…) instead of fixed colours. The classic look
 * has exactly the colours the best-of had before it had styles, and is what a
 * best-of saved without a style, or with one this version does not know, gets.
 */

// The cuts from one slide to the next, and how long each takes in beats of
// the month's music, so a cut keeps the music's pace as an edit to music
// would. The slide being left stays mounted beneath the new one, making its
// own exit, until the cut is over (BestOfViewer.jsx; the moves are in
// bestOf.css).
export const TRANSITION_BEATS = {
  fade: 1,
  slide: 0.75,
  zoom: 0.75,
  wipe: 0.75,
  blur: 1,
  dip: 1.5,
  zoomThrough: 0.75,
  whip: 0.5,
  iris: 1,
  flash: 0.75,
  burn: 1.5,
}

// However fast or slow the music, a cut is neither a flicker nor a wait.
const MIN_TRANSITION_MS = 280
const MAX_TRANSITION_MS = 950

/** How long a cut takes at a beat of `beatMs`; a fade for one it does not know. */
export function transitionMs(name, beatMs) {
  const beats = TRANSITION_BEATS[name] ?? TRANSITION_BEATS.fade
  return Math.round(Math.min(MAX_TRANSITION_MS, Math.max(MIN_TRANSITION_MS, beats * beatMs)))
}

/** The look's cut for the `n`th cut of the story: its cuts take turns. */
export function transitionAt(look, n) {
  const list = look.transitions?.length ? look.transitions : ['fade']
  return list[((n % list.length) + list.length) % list.length]
}

// The app's own theme colours (index.css), as the best-of used them.
const CLASSIC_COLORS = {
  dark: '#141a2e',
  light: 'var(--color-cream)',
  light2: 'var(--color-cream-dark)',
  ink: 'var(--color-bark)',
  inkSoft: 'var(--color-bark-light)',
  accent: '#f59e0b',
  badge: 'var(--color-warm-white)',
  badgeInk: 'var(--color-bark)',
}

export const LOOKS = {
  classic: {
    intro: 'floating',
    outro: 'cards',
    transitions: ['fade'],
    text: 'words',
    colors: CLASSIC_COLORS,
    title: 'font-bold',
  },
  // Prints on a warm table: a stack of polaroids to open, the photos sliding
  // in one after another like prints dealt out.
  polaroid: {
    intro: 'stack',
    outro: 'stack',
    transitions: ['slide', 'flash', 'zoomThrough'],
    text: 'words',
    texture: { grain: 0.5, vignette: true, leaks: true },
    variants: { photo: 'print', count: 'stack', award: 'stamp' },
    colors: {
      dark: '#2b2420',
      light: '#f4ece0',
      light2: '#e3d5c0',
      ink: '#3b2f27',
      inkSoft: '#77624f',
      accent: '#d97706',
      badge: '#fffdf9',
      badgeInk: '#3b2f27',
    },
    title: 'font-bold',
  },
  // A film: black bars above and below, the title over a blurred still, and
  // every cut through black.
  cinema: {
    intro: 'title',
    outro: 'grid',
    transitions: ['dip', 'whip', 'burn', 'dip'],
    text: 'letters',
    texture: { grain: 0.8, vignette: true, flicker: true },
    letterbox: true,
    // Its light cards are dark too, so the controls stay white on them.
    darkSurfaces: true,
    variants: { photo: 'subtitle', count: 'counter', themes: 'titles', awardIntro: 'spotlight', award: 'credits' },
    colors: {
      dark: '#0b0b0d',
      light: '#121214',
      light2: '#1d1d21',
      ink: '#f4f1ea',
      inkSoft: '#b9b2a3',
      accent: '#d4af37',
      // White on gold is hard to read.
      onAccent: '#141210',
      badge: '#d4af37',
      badgeInk: '#141210',
    },
    title: 'font-semibold tracking-[0.08em] uppercase',
  },
  // A magazine: a cover with the month's name in big type, white pages, a red
  // accent, and pages wiped across.
  magazine: {
    intro: 'cover',
    outro: 'grid',
    transitions: ['wipe', 'whip', 'iris'],
    text: 'mask',
    texture: { grain: 0.15 },
    variants: { photo: 'page', count: 'giant', themes: 'list', awardIntro: 'accent', award: 'banner' },
    colors: {
      dark: '#111111',
      light: '#ffffff',
      light2: '#f1f1f1',
      ink: '#111111',
      inkSoft: '#555555',
      accent: '#e63946',
      badge: '#e63946',
      badgeInk: '#ffffff',
    },
    title: 'font-display uppercase tracking-wide',
  },
  // A party: deep purple and coral, photos zooming in, confetti for every
  // award.
  festival: {
    intro: 'floating',
    outro: 'cards',
    transitions: ['zoomThrough', 'flash', 'whip', 'zoom'],
    text: 'pop',
    texture: { leaks: true },
    confetti: true,
    variants: { photo: 'sticker', count: 'burst', themes: 'stickers', awardIntro: 'rays', award: 'medal' },
    colors: {
      dark: '#1d1340',
      light: '#fff4e6',
      light2: '#ffd9c2',
      ink: '#2a1a4a',
      inkSoft: '#6a4c8a',
      accent: '#ff6b6b',
      badge: '#ff6b6b',
      badgeInk: '#ffffff',
    },
    title: 'font-black',
  },
  // A diary: the month's calendar page torn off to open it, paper under the
  // text, a serif hand and pages turned over.
  diary: {
    intro: 'calendar',
    outro: 'stack',
    transitions: ['wipe', 'fade', 'iris'],
    text: 'write',
    texture: { grain: 0.4, vignette: true },
    paper: true,
    variants: { photo: 'journal', count: 'tally', themes: 'notes', awardIntro: 'paper', award: 'stamp' },
    colors: {
      dark: '#2a2620',
      light: '#f6efe0',
      light2: '#eadfc8',
      ink: '#3a2f24',
      inkSoft: '#7a6650',
      accent: '#8a5a44',
      badge: '#f6efe0',
      badgeInk: '#3a2f24',
    },
    title: 'font-serif italic font-semibold',
  },
  // Tiles: the month's photos falling into a grid around its name, and one
  // slide coming out of the blur of the last.
  mosaic: {
    intro: 'mosaic',
    outro: 'grid',
    transitions: ['blur', 'iris', 'zoomThrough'],
    text: 'mask',
    variants: { photo: 'tiles', count: 'squares', themes: 'tiles', awardIntro: 'accent', award: 'banner' },
    colors: {
      dark: '#10202a',
      light: '#eef6f5',
      light2: '#d3e8e5',
      ink: '#12303a',
      inkSoft: '#3f6a72',
      accent: '#2a9d8f',
      badge: '#2a9d8f',
      badgeInk: '#ffffff',
    },
    title: 'font-bold',
  },
  // Quiet: white, the month's name cut out of a photo, gentle fades.
  minimal: {
    intro: 'mask',
    outro: 'cards',
    transitions: ['fade', 'zoomThrough'],
    text: 'words',
    variants: { photo: 'passepartout', count: 'plain', themes: 'line', awardIntro: 'plain', award: 'below' },
    colors: {
      dark: '#18181b',
      light: '#fafafa',
      light2: '#ededed',
      ink: '#18181b',
      inkSoft: '#71717a',
      accent: '#18181b',
      // Its accent is its ink, which would vanish on a dark card.
      highlight: '#ffffff',
      badge: '#fafafa',
      badgeInk: '#18181b',
    },
    title: 'font-light tracking-tight',
  },
}

// Opening cards drawn on the look's light colour (BestOfIntros.jsx), so the
// controls go dark over them.
export const LIGHT_INTROS = new Set(['stack', 'mask'])

// The slides a look draws its own way (BestOfVariants.jsx), by kind: a single
// photo, the count, the themes, an award's announcement and the award. A kind
// a look does not name is drawn the classic way. These are the variants drawn
// on the look's light colour.
const LIGHT_VARIANTS = {
  photo: ['journal', 'passepartout'],
  count: ['stack', 'giant', 'tally', 'plain'],
  themes: ['list', 'notes', 'line'],
  awardIntro: ['paper', 'plain'],
  award: ['below'],
}

// The classic slides drawn on white.
const LIGHT_SLIDES = new Set(['count', 'themes', 'calendar', 'yearAgo', 'outro'])

/** The variant a look draws a slide in, or undefined for the classic one. */
export const variantOf = (look, kind) => look?.variants?.[kind]

/**
 * Whether a slide is drawn on the look's light colour, so the controls go
 * dark over it — never in a look that draws its light cards dark too.
 */
export function isLightSlide(slide, look) {
  if (!slide || look.darkSurfaces) return false
  if (slide.kind === 'intro') return LIGHT_INTROS.has(look.intro)
  const variant = variantOf(look, slide.kind)
  if (variant) return LIGHT_VARIANTS[slide.kind]?.includes(variant) ?? false
  return LIGHT_SLIDES.has(slide.kind)
}

/** The look's hand for a title, or `fallback` without a look. */
export const titleOf = (look, fallback = 'font-bold') => look?.title || fallback

/** A style's look; the classic one for none, or one this version does not know. */
export function lookOf(style) {
  return LOOKS[style] || LOOKS.classic
}

/** The look's colours as the custom properties the slides draw with. */
export function lookVars(look) {
  const c = look.colors
  return {
    '--bo-dark': c.dark,
    '--bo-light': c.light,
    '--bo-light-2': c.light2,
    '--bo-ink': c.ink,
    '--bo-ink-soft': c.inkSoft,
    '--bo-accent': c.accent,
    // The accent as text on a dark card or photo.
    '--bo-highlight': c.highlight || c.accent,
    // Text on the accent.
    '--bo-on-accent': c.onAccent || '#ffffff',
    '--bo-badge': c.badge,
    '--bo-badge-ink': c.badgeInk,
    // The trophy in the award's pill: the accent, unless the pill is the
    // accent already.
    '--bo-trophy': c.badge === c.accent ? c.badgeInk : c.accent,
  }
}

/**
 * The camera move utils/bestOf.js chose, so that photo after photo does not
 * push in the same way. One this version does not know — from a best-of saved
 * by a newer one — gets the push in.
 */
export const motionClass = (slide) => `bestof-motion-${MOTIONS.includes(slide?.motion) ? slide.motion : 'zoomIn'}`

/**
 * How many beats each photo of a montage is up: one where a beat is long
 * enough to see a photo in, more where the music is quick, so a cut comes
 * about every second whatever the tempo.
 */
export function montageBeatsPerPhoto(beatMs) {
  return Math.max(1, Math.round(900 / (beatMs || 600)))
}

/** A montage's time in beats: its photos, and two to hold the last one. */
export function montageBeats(photos, beatMs) {
  return photos * montageBeatsPerPhoto(beatMs) + 2
}
