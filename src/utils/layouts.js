// Shared scrapbook page layout presets.
//
// Page coordinates are 900 (W) × 600 (H) — landscape. Photo slots use
// `url: ''` so they render as "Tap to add photo" placeholders until the
// user fills them (see CanvasElement.jsx's photo render branch).

const photoSlot = (x, y, width, height, extra = {}) => ({
  type: 'photo',
  x,
  y,
  width,
  height,
  rotation: 0,
  url: '',
  polaroid: false,
  caption: '',
  ...extra,
})

export const LAYOUT_PRESETS = [
  {
    id: 'blank',
    label: 'Blank',
    preview: '⬜',
    elements: [],
  },
  {
    id: 'classic',
    label: 'Classic',
    preview: '▦',
    elements: [
      photoSlot(20, 20, 420, 280, { zIndex: 1 }),
      photoSlot(460, 20, 420, 280, { zIndex: 2 }),
      photoSlot(20, 310, 860, 270, { zIndex: 3 }),
    ],
  },
  {
    id: 'polaroid-scatter',
    label: 'Polaroid Scatter',
    preview: '📸',
    elements: [
      photoSlot(60, 60, 240, 260, { rotation: -8, polaroid: true, zIndex: 1 }),
      photoSlot(330, 170, 240, 260, { rotation: 5, polaroid: true, zIndex: 2 }),
      photoSlot(600, 60, 240, 260, { rotation: -3, polaroid: true, zIndex: 3 }),
    ],
  },
  {
    id: 'two-col',
    label: '2 Column',
    preview: '⬛⬛',
    elements: [
      photoSlot(20, 20, 420, 560, { zIndex: 1 }),
      photoSlot(460, 20, 420, 560, { zIndex: 2 }),
    ],
  },
  {
    id: 'stack',
    label: 'Stack',
    preview: '▭▭▭',
    elements: [
      photoSlot(20, 20, 280, 560, { zIndex: 1 }),
      photoSlot(310, 20, 280, 560, { zIndex: 2 }),
      photoSlot(600, 20, 280, 560, { zIndex: 3 }),
    ],
  },
  {
    id: 'full-bleed',
    label: 'Full Bleed',
    preview: '🖼️',
    elements: [
      photoSlot(0, 0, 900, 600, { zIndex: 1 }),
    ],
  },
  {
    id: 'photo-quote',
    label: 'Photo + Quote',
    preview: '📷✍️',
    elements: [
      photoSlot(20, 20, 520, 560, { zIndex: 1 }),
      {
        type: 'text',
        x: 560,
        y: 200,
        width: 320,
        height: 200,
        rotation: 0,
        zIndex: 2,
        text: 'Every moment is a treasure we keep forever.',
        fontSize: 26,
        color: '#2D1B0E',
        fontFamily: 'serif',
        fontWeight: 'normal',
        textAlign: 'center',
      },
    ],
  },
]

export const DEFAULT_NEW_PAGE_LAYOUT =
  LAYOUT_PRESETS.find((l) => l.id === 'classic') || LAYOUT_PRESETS[0]

// Clone a layout's elements with fresh UUIDs. Used by ADD_PAGE prefill and
// the sidebar's apply-layout button.
export function cloneLayoutElements(layout) {
  return (layout?.elements || []).map((el) => ({ ...el, id: crypto.randomUUID() }))
}
