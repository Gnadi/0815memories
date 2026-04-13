// Shared scrapbook page layout presets.
//
// Photo slots use `url: ''` so they render as "Tap to add photo" placeholders
// until the user fills them. See CanvasElement.jsx's photo render branch.

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
      photoSlot(20, 20, 370, 220, { zIndex: 1 }),
      photoSlot(410, 20, 370, 220, { zIndex: 2 }),
      photoSlot(20, 260, 760, 320, { zIndex: 3 }),
    ],
  },
  {
    id: 'polaroid-scatter',
    label: 'Polaroid Scatter',
    preview: '📸',
    elements: [
      photoSlot(60, 40, 280, 320, { rotation: -8, polaroid: true, zIndex: 1 }),
      photoSlot(340, 70, 260, 300, { rotation: 5, polaroid: true, zIndex: 2 }),
      photoSlot(190, 280, 240, 280, { rotation: -3, polaroid: true, zIndex: 3 }),
    ],
  },
  {
    id: 'two-col',
    label: '2 Column',
    preview: '⬛⬛',
    elements: [
      photoSlot(20, 20, 370, 560, { zIndex: 1 }),
      photoSlot(410, 20, 370, 560, { zIndex: 2 }),
    ],
  },
  {
    id: 'strip',
    label: 'Strip',
    preview: '▪▪▪',
    elements: [
      photoSlot(20, 180, 240, 240, { zIndex: 1 }),
      photoSlot(280, 180, 240, 240, { zIndex: 2 }),
      photoSlot(540, 180, 240, 240, { zIndex: 3 }),
    ],
  },
  {
    id: 'full-bleed',
    label: 'Full Bleed',
    preview: '🖼️',
    elements: [
      photoSlot(0, 0, 800, 600, { zIndex: 1 }),
    ],
  },
  {
    id: 'photo-quote',
    label: 'Photo + Quote',
    preview: '📷✍️',
    elements: [
      photoSlot(20, 20, 380, 560, { zIndex: 1 }),
      {
        type: 'text',
        x: 430,
        y: 180,
        width: 350,
        height: 240,
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
