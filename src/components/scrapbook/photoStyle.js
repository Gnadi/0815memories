// Filters and frames for scrapbook photos.
//
// The editor shows a filter with CSS `filter`; the PDF export paints photos
// onto a <canvas>, where `ctx.filter` is missing in Safari. So every preset is
// built only from CSS filter functions whose colour matrices the Filter
// Effects spec defines, and the export applies those same matrices to the
// pixels itself. One list of steps, two renderings that agree.

export const FILTER_PRESETS = [
  { id: 'none', steps: [] },
  { id: 'bw', steps: [['grayscale', 1], ['contrast', 1.1]] },
  { id: 'sepia', steps: [['sepia', 0.85]] },
  { id: 'warm', steps: [['sepia', 0.3], ['saturate', 1.3], ['brightness', 1.03]] },
  { id: 'vintage', steps: [['sepia', 0.45], ['contrast', 0.88], ['brightness', 1.08], ['saturate', 0.8]] },
  { id: 'vivid', steps: [['saturate', 1.5], ['contrast', 1.1]] },
  { id: 'fade', steps: [['contrast', 0.78], ['brightness', 1.12], ['saturate', 0.7]] },
  { id: 'cool', steps: [['hue-rotate', 12], ['saturate', 0.9], ['brightness', 1.04]] },
]

const presetOf = (id) => FILTER_PRESETS.find((p) => p.id === id) || null

/** The CSS `filter` value for a preset id, or undefined for none/unknown. */
export function filterCss(id) {
  const preset = presetOf(id)
  if (!preset || preset.steps.length === 0) return undefined
  return preset.steps
    .map(([fn, v]) => (fn === 'hue-rotate' ? `hue-rotate(${v}deg)` : `${fn}(${v})`))
    .join(' ')
}

// ─── Colour matrices (Filter Effects Module, §"filter functions") ────────────
// Each is 3 rows of [r, g, b, offset], offsets in 0…1 units.

function grayscale(a) {
  const s = 1 - Math.min(1, a)
  return [
    [0.2126 + 0.7874 * s, 0.7152 - 0.7152 * s, 0.0722 - 0.0722 * s, 0],
    [0.2126 - 0.2126 * s, 0.7152 + 0.2848 * s, 0.0722 - 0.0722 * s, 0],
    [0.2126 - 0.2126 * s, 0.7152 - 0.7152 * s, 0.0722 + 0.9278 * s, 0],
  ]
}

function sepia(a) {
  const s = 1 - Math.min(1, a)
  return [
    [0.393 + 0.607 * s, 0.769 - 0.769 * s, 0.189 - 0.189 * s, 0],
    [0.349 - 0.349 * s, 0.686 + 0.314 * s, 0.168 - 0.168 * s, 0],
    [0.272 - 0.272 * s, 0.534 - 0.534 * s, 0.131 + 0.869 * s, 0],
  ]
}

function saturate(s) {
  return [
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0],
  ]
}

function hueRotate(deg) {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return [
    [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0],
    [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283, 0],
    [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0],
  ]
}

const brightness = (b) => [[b, 0, 0, 0], [0, b, 0, 0], [0, 0, b, 0]]
const contrast = (c) => [[c, 0, 0, 0.5 - 0.5 * c], [0, c, 0, 0.5 - 0.5 * c], [0, 0, c, 0.5 - 0.5 * c]]

const MATRICES = { grayscale, sepia, saturate, 'hue-rotate': hueRotate, brightness, contrast }

// b ∘ a: apply `a` first, then `b`.
function compose(b, a) {
  return b.map((row) => [
    row[0] * a[0][0] + row[1] * a[1][0] + row[2] * a[2][0],
    row[0] * a[0][1] + row[1] * a[1][1] + row[2] * a[2][1],
    row[0] * a[0][2] + row[1] * a[1][2] + row[2] * a[2][2],
    row[0] * a[0][3] + row[1] * a[1][3] + row[2] * a[2][3] + row[3],
  ])
}

/**
 * The single matrix a preset boils down to, or null for no filter. CSS clamps
 * to 0…1 after every function, which a single matrix does not; the presets
 * stay mild enough that the difference is invisible.
 */
export function filterMatrix(id) {
  const preset = presetOf(id)
  if (!preset || preset.steps.length === 0) return null
  return preset.steps.reduce(
    (m, [fn, v]) => compose(MATRICES[fn](v), m),
    [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]],
  )
}

/** Apply a preset to RGBA pixel data in place (alpha untouched). */
export function applyFilterToPixels(data, id) {
  const m = filterMatrix(id)
  if (!m) return
  const [r0, g0, b0] = m
  const o0 = r0[3] * 255
  const o1 = g0[3] * 255
  const o2 = b0[3] * 255
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    data[i] = r0[0] * r + r0[1] * g + r0[2] * b + o0
    data[i + 1] = g0[0] * r + g0[1] * g + g0[2] * b + o1
    data[i + 2] = b0[0] * r + b0[1] * g + b0[2] * b + o2
  }
}

// ─── Frames ──────────────────────────────────────────────────────────────────

export const FRAME_COLORS = [
  '#FFFFFF', '#FDF6EC', '#F5E6D0', '#2D1B0E', '#1C1917',
  '#C25A2E', '#E91E8C', '#3B5E8A', '#4A7C59', '#7B3F6E', '#D4AF37',
]
export const MAX_FRAME_WIDTH = 24

/**
 * Corner radius in pixels for a photo frame of w × h. `cornerRadius` is stored
 * as a share of the shorter side (0 … 0.5, where 0.5 is a circle or pill).
 * Photos from before the setting existed keep their small rounding, except
 * polaroids, which were always square-cornered inside the white border.
 */
export function frameRadius(element, w, h) {
  if (typeof element?.cornerRadius === 'number') {
    return Math.max(0, Math.min(0.5, element.cornerRadius)) * Math.min(w, h)
  }
  return element?.polaroid ? 0 : 4
}

export function frameBorder(element) {
  const width = Math.max(0, Math.min(MAX_FRAME_WIDTH, element?.borderWidth || 0))
  return width > 0 ? { width, color: element.borderColor || '#FFFFFF' } : null
}
