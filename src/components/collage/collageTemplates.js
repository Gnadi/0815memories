// Collage templates — the layouts a customer picks from the gallery.
//
// Coordinates are fractions of the canvas (0–1), not pixels, so one spec
// renders identically as a 128 px gallery thumbnail and as a 1600 px export.
// That is the difference to `scrapbook/layoutPresets.js`, which is pixel-based
// because the scrapbook canvas is always 800 × 600.
//
// A template is three things:
//   background   a colour, or a gradient spec painted by the renderer
//   decorations  vector artwork (daisies, hearts, confetti, film sprockets…)
//                drawn behind the photos, or in front when `layer: 'front'`
//   slots        where the photos go, and how each one is framed
//
// Slot shapes: rect · rounded · pill · circle · arch.
// Slot extras: `frame` puts the photo on a mat (a polaroid border, a card),
// `stroke` draws a keyline around it, `radius` overrides the rounding.
//
// A slot only describes geometry and styling. What fills it lives in the
// collage document (see useCollages), so improving a template also improves
// every collage already made from it.

import { scatterEdge } from './collageDecorations'

export const ASPECTS = {
  '1:1': 1,
  '4:5': 4 / 5,
  '9:16': 9 / 16,
  '3:2': 3 / 2,
}

export const DEFAULT_ASPECT = '4:5'

// Border defaults applied to a fresh collage. `width` and `gap` are fractions
// of the canvas width, `radius` a fraction of the slot's short side — all
// relative so the same numbers hold at thumbnail and export size.
//
// Width starts at 0: every template already carries its own framing, and the
// Borders tab is there to override it, not to be required.
export const DEFAULT_BORDER = {
  color: '#FFFDF9',
  width: 0,
  radius: 0.08,
  gap: 0,
}

// Border colours offered in the editor's "Borders" tab.
export const BORDER_COLORS = [
  '#FFFDF9', '#FDF6EC', '#2D1B0E', '#C2352E', '#E0644B',
  '#F4B942', '#2BB3B0', '#4A7C59', '#7B3F6E', '#1C1917',
]

const slot = (id, x, y, w, h, opts = {}) => ({
  id,
  x, y, w, h,
  rotation: 0,
  shape: 'rounded',
  ...opts,
})

// A white photo mat, the polaroid look.
const POLAROID = { color: '#FFFFFF', pad: 0.018, padBottom: 0.055, shadow: true, radius: 0.004 }
const CARD = { color: '#FFFFFF', pad: 0.016, shadow: true, radius: 0.01 }

export const COLLAGE_TEMPLATES = [
  // ── Bold single-photo frames ─────────────────────────────────────────────
  {
    // Teal field ringed with daisies — the photo sits in a white keyline.
    id: 'daisy-field',
    labelKey: 'templates.daisyField',
    group: 'featured',
    aspect: '4:5',
    background: { type: 'linear', angle: 115, colors: ['#31C5C0', '#1FA8A5'] },
    decorations: [
      ...scatterEdge('daisy', 14, { r: 0.075, color: '#FFFFFF', centerColor: '#F6A723' }, 11),
    ],
    slots: [
      slot('a', 0.12, 0.09, 0.76, 0.82, {
        radius: 0.09,
        stroke: { color: '#EAFBFA', width: 0.012 },
      }),
    ],
  },
  {
    // Deep poppy red with a cream mat — warm, editorial, high contrast.
    id: 'bloom-red',
    labelKey: 'templates.bloomRed',
    group: 'featured',
    aspect: '4:5',
    background: { type: 'linear', angle: 120, colors: ['#D8412F', '#A8231C'] },
    decorations: [
      { type: 'band', x: 0.07, y: 0.055, w: 0.86, h: 0.89, radius: 0.07, color: '#F7EBD8' },
    ],
    slots: [
      slot('a', 0.115, 0.10, 0.77, 0.80, { radius: 0.06 }),
    ],
  },
  {
    // White card, hand-drawn hearts, arch-topped photo.
    id: 'love-note',
    labelKey: 'templates.loveNote',
    group: 'featured',
    aspect: '4:5',
    background: '#FFFFFF',
    decorations: [
      { type: 'heart', x: 0.145, y: 0.085, r: 0.075, rotation: -14, color: null, outline: '#1C1917', outlineWidth: 0.013 },
      { type: 'heart', x: 0.275, y: 0.055, r: 0.045, rotation: 10, color: null, outline: '#1C1917', outlineWidth: 0.011 },
      { type: 'heart', x: 0.855, y: 0.925, r: 0.075, rotation: 12, color: null, outline: '#1C1917', outlineWidth: 0.013 },
      { type: 'heart', x: 0.715, y: 0.955, r: 0.042, rotation: -8, color: null, outline: '#1C1917', outlineWidth: 0.011 },
    ],
    slots: [
      slot('a', 0.13, 0.10, 0.74, 0.80, { shape: 'arch' }),
    ],
  },
  {
    // Confetti and a gold trim — birthdays, parties, New Year.
    id: 'confetti-gold',
    labelKey: 'templates.confettiGold',
    group: 'featured',
    aspect: '4:5',
    background: '#FFFDF9',
    decorations: [
      {
        type: 'confetti', seed: 42, count: 150,
        colors: ['#D8A93A', '#F0C75E', '#EC6A5E', '#F2A0B5', '#C9D46B', '#8FB6D8'],
        minR: 0.005, maxR: 0.015,
        // Only the margin, so the corners are as busy as the sides.
        areas: [
          { x: 0.01, y: 0.005, w: 0.98, h: 0.115 },
          { x: 0.01, y: 0.88, w: 0.98, h: 0.115 },
          { x: 0.005, y: 0.10, w: 0.14, h: 0.80 },
          { x: 0.855, y: 0.10, w: 0.14, h: 0.80 },
        ],
      },
      // The outer keyline of the double gold trim; the slot draws the inner one.
      { type: 'stroke', color: '#C9982F', lineWidth: 0.006, points: [
        [0.135, 0.098], [0.865, 0.098], [0.865, 0.902], [0.135, 0.902], [0.135, 0.098],
      ] },
    ],
    slots: [
      slot('a', 0.155, 0.12, 0.69, 0.76, {
        radius: 0.02,
        stroke: { color: '#C9982F', width: 0.013 },
      }),
    ],
  },
  {
    // Warm sunburst with a circular cut-out and twinkles.
    id: 'sunburst',
    labelKey: 'templates.sunburst',
    group: 'featured',
    aspect: '1:1',
    background: { type: 'radial', center: [0.5, 0.45], radius: 0.75, colors: ['#FFD37E', '#F58A3C', '#D2452F'] },
    decorations: [
      { type: 'sparkle', x: 0.16, y: 0.18, r: 0.06, color: '#FFF3D6' },
      { type: 'sparkle', x: 0.86, y: 0.24, r: 0.04, color: '#FFF3D6' },
      { type: 'sparkle', x: 0.80, y: 0.86, r: 0.055, color: '#FFF3D6' },
      { type: 'sparkle', x: 0.20, y: 0.82, r: 0.035, color: '#FFF3D6' },
    ],
    slots: [
      slot('a', 0.14, 0.14, 0.72, 0.72, {
        shape: 'circle',
        stroke: { color: '#FFF3D6', width: 0.016 },
      }),
    ],
  },

  // ── Two and three photos ────────────────────────────────────────────────
  {
    // Two tilted film strips, the way the reference lays a beach day out.
    id: 'film-strip',
    labelKey: 'templates.filmStrip',
    group: 'multi',
    aspect: '4:5',
    background: { type: 'linear', angle: 120, colors: ['#E9E4DC', '#CFC8BD'] },
    decorations: [
      // On a 4:5 canvas the first strip is taller than it is wide, so its
      // sprockets run down the sides; the second is wider than tall, so its
      // sprockets run along the top and bottom. Each photo is inset on
      // whichever pair of edges carries the holes.
      { type: 'filmStrip', x: 0.04, y: 0.03, w: 0.74, h: 0.64, rotation: -5, color: '#FCFAF6', holeColor: '#BFB8AC', holes: 8 },
      { type: 'filmStrip', x: 0.28, y: 0.56, w: 0.68, h: 0.41, rotation: 4, color: '#FCFAF6', holeColor: '#BFB8AC', holes: 7 },
    ],
    slots: [
      // Pivoted on each strip's centre so the tilt matches the strip exactly.
      slot('a', 0.125, 0.049, 0.570, 0.602, { rotation: -5, shape: 'rect', pivot: [0.41, 0.35] }),
      slot('b', 0.300, 0.617, 0.640, 0.295, { rotation: 4, shape: 'rect', pivot: [0.62, 0.765] }),
    ],
  },
  {
    // Two polaroids on warm paper with a flower doodle.
    id: 'polaroid-pair',
    labelKey: 'templates.polaroidPair',
    group: 'multi',
    aspect: '4:5',
    background: { type: 'linear', angle: 110, colors: ['#F3EDE3', '#E4DACB'] },
    decorations: [
      { type: 'flowerSpray', x: 0.12, y: 0.56, scale: 0.30, rotation: -14, petalColor: '#E98074', leafColor: '#A3B565' },
      { type: 'flowerSpray', x: 0.86, y: 0.99, scale: 0.26, rotation: 12, petalColor: '#E98074', leafColor: '#A3B565', layer: 'front' },
      { type: 'confetti', seed: 5, count: 14, colors: ['#E98074', '#C97F63'], minR: 0.004, maxR: 0.009 },
    ],
    slots: [
      slot('a', 0.28, 0.055, 0.58, 0.44, { rotation: 3, shape: 'rect', frame: POLAROID }),
      slot('b', 0.11, 0.47, 0.58, 0.44, { rotation: -4, shape: 'rect', frame: POLAROID }),
    ],
  },
  {
    // Coral field with a pink sweep and heart stickers; one big photo, one inset.
    id: 'pop-hearts',
    labelKey: 'templates.popHearts',
    group: 'multi',
    aspect: '4:5',
    background: '#F2544B',
    decorations: [
      { type: 'band', x: 0.0, y: 0.0, w: 0.72, h: 0.78, radius: 0.16, color: '#F9A8C8' },
      { type: 'heart', x: 0.86, y: 0.17, r: 0.075, rotation: 14, color: '#7EB6F0', outline: '#FFFFFF', outlineWidth: 0.011, layer: 'front' },
      { type: 'heart', x: 0.19, y: 0.90, r: 0.07, rotation: -10, color: '#F0629B', outline: '#FFFFFF', outlineWidth: 0.011, layer: 'front' },
    ],
    slots: [
      slot('a', 0.02, 0.02, 0.66, 0.72, { radius: 0.10 }),
      slot('b', 0.42, 0.68, 0.56, 0.30, {
        radius: 0.07,
        stroke: { color: '#F6C445', width: 0.016 },
      }),
    ],
  },
  {
    // Three full-width bands with hairline gaps — the clean travel look.
    id: 'stacked-trio',
    labelKey: 'templates.stackedTrio',
    group: 'multi',
    aspect: '4:5',
    background: '#FFFFFF',
    decorations: [],
    slots: [
      slot('a', 0.03, 0.025, 0.94, 0.305, { radius: 0.05 }),
      slot('b', 0.03, 0.345, 0.94, 0.305, { radius: 0.05 }),
      slot('c', 0.03, 0.665, 0.94, 0.305, { radius: 0.05 }),
    ],
  },
  {
    // Portrait strip for stories: three tall frames on a dusk gradient.
    id: 'story-trio',
    labelKey: 'templates.storyTrio',
    group: 'multi',
    aspect: '9:16',
    background: { type: 'linear', angle: 100, colors: ['#3B2A6B', '#8E4A7E', '#E0644B'] },
    decorations: [
      { type: 'sparkle', x: 0.12, y: 0.06, r: 0.05, color: '#FFE8C7' },
      { type: 'sparkle', x: 0.9, y: 0.5, r: 0.04, color: '#FFE8C7' },
      { type: 'sparkle', x: 0.14, y: 0.95, r: 0.045, color: '#FFE8C7' },
    ],
    slots: [
      slot('a', 0.08, 0.04, 0.84, 0.29, { radius: 0.06, frame: CARD }),
      slot('b', 0.08, 0.355, 0.84, 0.29, { radius: 0.06, frame: CARD }),
      slot('c', 0.08, 0.67, 0.84, 0.29, { radius: 0.06, frame: CARD }),
    ],
  },

  // ── Grids ────────────────────────────────────────────────────────────────
  {
    // Four photos, each on its own card, scattered a couple of degrees.
    id: 'mint-four',
    labelKey: 'templates.mintFour',
    group: 'grid',
    aspect: '1:1',
    background: { type: 'linear', angle: 130, colors: ['#BFE6C8', '#7FC8A9'] },
    decorations: [
      { type: 'daisy', x: 0.5, y: 0.5, r: 0.07, color: '#FFFFFF', centerColor: '#F6A723', layer: 'front' },
      { type: 'confetti', seed: 9, count: 22, colors: ['#FFFFFF', '#F6D186'], minR: 0.005, maxR: 0.011 },
    ],
    slots: [
      slot('a', 0.055, 0.055, 0.40, 0.40, { rotation: -2, frame: CARD, radius: 0.03 }),
      slot('b', 0.545, 0.055, 0.40, 0.40, { rotation: 2, frame: CARD, radius: 0.03 }),
      slot('c', 0.055, 0.545, 0.40, 0.40, { rotation: 2, frame: CARD, radius: 0.03 }),
      slot('d', 0.545, 0.545, 0.40, 0.40, { rotation: -2, frame: CARD, radius: 0.03 }),
    ],
  },
  {
    // Six up on a night gradient — a whole trip on one card.
    id: 'night-six',
    labelKey: 'templates.nightSix',
    group: 'grid',
    aspect: '4:5',
    background: { type: 'linear', angle: 115, colors: ['#1F2A54', '#5B2A67', '#C2352E'] },
    decorations: [
      { type: 'confetti', seed: 3, count: 30, colors: ['#FFD9A0', '#FFFFFF', '#F2A0B5'], minR: 0.004, maxR: 0.010 },
    ],
    slots: [
      slot('a', 0.05, 0.045, 0.42, 0.29, { radius: 0.05 }),
      slot('b', 0.53, 0.045, 0.42, 0.29, { radius: 0.05 }),
      slot('c', 0.05, 0.355, 0.42, 0.29, { radius: 0.05 }),
      slot('d', 0.53, 0.355, 0.42, 0.29, { radius: 0.05 }),
      slot('e', 0.05, 0.665, 0.42, 0.29, { radius: 0.05 }),
      slot('f', 0.53, 0.665, 0.42, 0.29, { radius: 0.05 }),
    ],
  },
  {
    // One hero, two below — the magazine spread, on a sunlit wash.
    id: 'sun-hero',
    labelKey: 'templates.sunHero',
    group: 'grid',
    aspect: '4:5',
    background: { type: 'linear', angle: 100, colors: ['#FFE3B0', '#F7A072'] },
    decorations: [
      { type: 'stroke', points: [[0.08, 0.955], [0.92, 0.955]], color: '#FFFFFF', lineWidth: 0.008 },
      { type: 'sparkle', x: 0.9, y: 0.06, r: 0.045, color: '#FFFFFF' },
    ],
    slots: [
      slot('a', 0.07, 0.06, 0.86, 0.55, { radius: 0.05, frame: CARD }),
      slot('b', 0.07, 0.65, 0.41, 0.26, { radius: 0.05, frame: CARD }),
      slot('c', 0.52, 0.65, 0.41, 0.26, { radius: 0.05, frame: CARD }),
    ],
  },
  {
    // Full bleed, one photo, nothing in the way.
    id: 'full-bleed',
    labelKey: 'templates.fullBleed',
    group: 'grid',
    aspect: '4:5',
    background: '#1C1917',
    decorations: [],
    slots: [
      slot('a', 0, 0, 1, 1, { shape: 'rect' }),
    ],
  },
]

export function getTemplate(templateId) {
  return COLLAGE_TEMPLATES.find((tpl) => tpl.id === templateId) || COLLAGE_TEMPLATES[0]
}

/**
 * The width ÷ height ratio a collage document renders at.
 */
export function aspectRatioOf(docOrTemplate) {
  const aspect = docOrTemplate?.aspect || getTemplate(docOrTemplate?.templateId).aspect
  return ASPECTS[aspect] ?? ASPECTS[DEFAULT_ASPECT]
}

/**
 * Canvas pixel size for a template at a given width.
 */
export function templateSize(template, width) {
  const ratio = ASPECTS[template.aspect] ?? ASPECTS[DEFAULT_ASPECT]
  return { width, height: Math.round(width / ratio) }
}

/**
 * A fresh, empty collage document for a template.
 *
 * `background: null` means "whatever the template says" — only a colour the
 * customer picks in the Borders tab is stored, so a template restyle reaches
 * collages that never overrode it.
 */
export function makeCollageDoc(template) {
  return {
    templateId: template.id,
    aspect: template.aspect,
    background: null,
    border: { ...DEFAULT_BORDER },
    slots: template.slots.map((s) => ({
      id: s.id,
      url: null,
      thumbUrl: null,
      imageScale: 1,
      offsetX: 0,
      offsetY: 0,
      flipped: false,
    })),
  }
}

/**
 * A template filled with the given photos, for previews. Photos repeat when
 * there are fewer of them than the template has slots, so a family with two
 * photos still sees what a six-slot grid looks like.
 */
export function fillTemplate(template, photos = []) {
  const doc = makeCollageDoc(template)
  if (photos.length === 0) return doc
  return {
    ...doc,
    slots: doc.slots.map((s, i) => {
      const photo = photos[i % photos.length]
      return {
        ...s,
        url: typeof photo === 'string' ? photo : photo?.url ?? null,
        thumbUrl: typeof photo === 'string' ? null : photo?.thumbUrl ?? null,
      }
    }),
  }
}

/**
 * Move an existing document onto another template, keeping the photos the user
 * already placed. Fills the new slots in order — a 4-photo collage switched to
 * a 2-slot template keeps the first two.
 */
export function applyTemplate(doc, template) {
  const filled = (doc?.slots || []).filter((s) => s.url)
  return {
    ...makeCollageDoc(template),
    // Styling the customer chose survives the switch; a background they never
    // touched stays null so the new template's own artwork shows through.
    background: doc?.background ?? null,
    border: doc?.border ? { ...doc.border } : { ...DEFAULT_BORDER },
    slots: template.slots.map((s, i) => ({
      id: s.id,
      url: filled[i]?.url ?? null,
      thumbUrl: filled[i]?.thumbUrl ?? null,
      imageScale: filled[i]?.imageScale ?? 1,
      offsetX: filled[i]?.offsetX ?? 0,
      offsetY: filled[i]?.offsetY ?? 0,
      flipped: filled[i]?.flipped ?? false,
    })),
  }
}
