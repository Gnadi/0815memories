// Collage templates — the layouts a customer picks from the gallery.
//
// Coordinates are fractions of the canvas (0–1), not pixels, so one spec
// renders identically as a 240 px gallery thumbnail and as a 1600 px export.
// That is the difference to `scrapbook/layoutPresets.js`, which is pixel-based
// because the scrapbook canvas is always 800 × 600.
//
// Slot shapes:
//   rect    — plain rectangle
//   rounded — rounded corners, radius is a fraction of the slot's short side
//   pill    — fully rounded ends (radius = half the short side)
//   circle  — ellipse inscribed in the slot box
//
// A slot only describes geometry. What fills it lives in the collage document
// (see useCollages), so improving a template also improves existing collages.

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
export const DEFAULT_BORDER = {
  color: '#FFFDF9',
  width: 0,
  radius: 0.08,
  gap: 0.012,
}

// Border colours offered in the editor's "Borders" tab.
export const BORDER_COLORS = [
  '#FFFDF9', '#FDF6EC', '#2D1B0E', '#C25A2E', '#3B5E8A',
  '#4A7C59', '#7B3F6E', '#F7D6C4', '#A8C7FA', '#1C1917',
]

const slot = (id, x, y, w, h, opts = {}) => ({
  id,
  x, y, w, h,
  rotation: 0,
  shape: 'rounded',
  ...opts,
})

export const COLLAGE_TEMPLATES = [
  {
    // The reference design: one tall pill-shaped cut-out on a coloured field.
    id: 'pill-hero',
    labelKey: 'templates.pillHero',
    group: 'featured',
    aspect: '4:5',
    background: '#A8C7FA',
    slots: [
      slot('a', 0.14, 0.08, 0.72, 0.84, { shape: 'pill' }),
    ],
  },
  {
    id: 'full-bleed',
    labelKey: 'templates.fullBleed',
    group: 'featured',
    aspect: '4:5',
    background: '#2D1B0E',
    slots: [
      slot('a', 0, 0, 1, 1, { shape: 'rect' }),
    ],
  },
  {
    id: 'circle-center',
    labelKey: 'templates.circleCenter',
    group: 'featured',
    aspect: '1:1',
    background: '#F5E6D0',
    slots: [
      slot('a', 0.12, 0.12, 0.76, 0.76, { shape: 'circle' }),
    ],
  },
  {
    id: 'two-up',
    labelKey: 'templates.twoUp',
    group: 'grid',
    aspect: '4:5',
    background: '#FDF6EC',
    slots: [
      slot('a', 0.04, 0.04, 0.92, 0.45),
      slot('b', 0.04, 0.51, 0.92, 0.45),
    ],
  },
  {
    id: 'side-by-side',
    labelKey: 'templates.sideBySide',
    group: 'grid',
    aspect: '1:1',
    background: '#FDF6EC',
    slots: [
      slot('a', 0.04, 0.04, 0.45, 0.92),
      slot('b', 0.51, 0.04, 0.45, 0.92),
    ],
  },
  {
    id: 'hero-two',
    labelKey: 'templates.heroTwo',
    group: 'grid',
    aspect: '4:5',
    background: '#FFFDF9',
    slots: [
      slot('a', 0.04, 0.04, 0.92, 0.58),
      slot('b', 0.04, 0.64, 0.45, 0.32),
      slot('c', 0.51, 0.64, 0.45, 0.32),
    ],
  },
  {
    id: 'four-grid',
    labelKey: 'templates.fourGrid',
    group: 'grid',
    aspect: '1:1',
    background: '#FDF6EC',
    slots: [
      slot('a', 0.04, 0.04, 0.45, 0.45),
      slot('b', 0.51, 0.04, 0.45, 0.45),
      slot('c', 0.04, 0.51, 0.45, 0.45),
      slot('d', 0.51, 0.51, 0.45, 0.45),
    ],
  },
  {
    id: 'six-grid',
    labelKey: 'templates.sixGrid',
    group: 'grid',
    aspect: '4:5',
    background: '#FDF6EC',
    slots: [
      slot('a', 0.04, 0.04, 0.45, 0.30),
      slot('b', 0.51, 0.04, 0.45, 0.30),
      slot('c', 0.04, 0.36, 0.45, 0.30),
      slot('d', 0.51, 0.36, 0.45, 0.30),
      slot('e', 0.04, 0.68, 0.45, 0.28),
      slot('f', 0.51, 0.68, 0.45, 0.28),
    ],
  },
  {
    id: 'film-strip',
    labelKey: 'templates.filmStrip',
    group: 'grid',
    aspect: '9:16',
    background: '#1C1917',
    slots: [
      slot('a', 0.08, 0.05, 0.84, 0.28, { shape: 'rect' }),
      slot('b', 0.08, 0.36, 0.84, 0.28, { shape: 'rect' }),
      slot('c', 0.08, 0.67, 0.84, 0.28, { shape: 'rect' }),
    ],
  },
  {
    id: 'magazine',
    labelKey: 'templates.magazine',
    group: 'styled',
    aspect: '4:5',
    background: '#EFE7DA',
    slots: [
      slot('a', 0.10, 0.08, 0.80, 0.62),
      slot('b', 0.10, 0.74, 0.38, 0.18),
      slot('c', 0.52, 0.74, 0.38, 0.18),
    ],
  },
  {
    id: 'polaroid-scatter',
    labelKey: 'templates.polaroidScatter',
    group: 'styled',
    aspect: '4:5',
    background: '#E7E5E4',
    slots: [
      slot('a', 0.08, 0.08, 0.50, 0.42, { rotation: -7 }),
      slot('b', 0.44, 0.28, 0.48, 0.40, { rotation: 6 }),
      slot('c', 0.16, 0.56, 0.52, 0.38, { rotation: -3 }),
    ],
  },
  {
    id: 'stacked-circles',
    labelKey: 'templates.stackedCircles',
    group: 'styled',
    aspect: '4:5',
    background: '#F7D6C4',
    slots: [
      slot('a', 0.10, 0.06, 0.56, 0.44, { shape: 'circle' }),
      slot('b', 0.38, 0.34, 0.54, 0.42, { shape: 'circle' }),
      slot('c', 0.16, 0.60, 0.50, 0.36, { shape: 'circle' }),
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
 */
export function makeCollageDoc(template) {
  return {
    templateId: template.id,
    aspect: template.aspect,
    background: template.background,
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
    slots: doc.slots.map((slot, i) => {
      const photo = photos[i % photos.length]
      return {
        ...slot,
        url: typeof photo === 'string' ? photo : photo?.url ?? null,
        thumbUrl: typeof photo === 'string' ? null : photo?.thumbUrl ?? null,
      }
    }),
  }
}

/**
 * Move an existing document onto another template, keeping the photos the user
 * already placed. Fills the new slots in order — a 4-photo collage switched to
 * a 2-slot template keeps the first two, and switching back restores nothing it
 * did not carry, which is why the caller keeps the extras in its own state.
 */
export function applyTemplate(doc, template) {
  const filled = (doc?.slots || []).filter((s) => s.url)
  return {
    ...makeCollageDoc(template),
    // Background/border are the user's styling choices, so they survive a
    // template switch unless the previous background was the template default.
    background: doc?.background && doc.background !== getTemplate(doc.templateId).background
      ? doc.background
      : template.background,
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
