// Shared scrapbook page layout presets.
//
// Page coordinates are 600 (W) × 900 (H) — portrait. Photo slots use
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
      photoSlot(20, 20, 270, 260, { zIndex: 1 }),
      photoSlot(310, 20, 270, 260, { zIndex: 2 }),
      photoSlot(20, 300, 560, 580, { zIndex: 3 }),
    ],
  },
  {
    id: 'polaroid-scatter',
    label: 'Polaroid Scatter',
    preview: '📸',
    elements: [
      photoSlot(40, 60, 250, 280, { rotation: -8, polaroid: true, zIndex: 1 }),
      photoSlot(300, 220, 250, 280, { rotation: 5, polaroid: true, zIndex: 2 }),
      photoSlot(160, 560, 260, 290, { rotation: -3, polaroid: true, zIndex: 3 }),
    ],
  },
  {
    id: 'two-col',
    label: '2 Column',
    preview: '⬛⬛',
    elements: [
      photoSlot(20, 20, 270, 860, { zIndex: 1 }),
      photoSlot(310, 20, 270, 860, { zIndex: 2 }),
    ],
  },
  {
    id: 'stack',
    label: 'Stack',
    preview: '▭▭▭',
    elements: [
      photoSlot(20, 20, 560, 280, { zIndex: 1 }),
      photoSlot(20, 310, 560, 280, { zIndex: 2 }),
      photoSlot(20, 600, 560, 280, { zIndex: 3 }),
    ],
  },
  {
    id: 'full-bleed',
    label: 'Full Bleed',
    preview: '🖼️',
    elements: [
      photoSlot(0, 0, 600, 900, { zIndex: 1 }),
    ],
  },
  {
    id: 'photo-quote',
    label: 'Photo + Quote',
    preview: '📷✍️',
    elements: [
      photoSlot(20, 20, 560, 600, { zIndex: 1 }),
      {
        type: 'text',
        x: 20,
        y: 650,
        width: 560,
        height: 220,
        rotation: 0,
        zIndex: 2,
        text: 'Every moment is a treasure we keep forever.',
        fontSize: 28,
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
