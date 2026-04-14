// Layout presets for the photobook editor.
// Each layout is a list of element templates (same schema as canvas elements:
// type, x, y, width, height, rotation, zIndex, plus type-specific fields).
// Photo elements without a `url` are rendered as empty "Tap to add photo" slots.
// Canvas dimensions match ScrapbookCanvas (800 × 600).

const W = 800
const H = 600

// Helper to create an empty photo slot
const slot = (x, y, width, height, rotation = 0, zIndex = 1, extra = {}) => ({
  type: 'photo',
  isSlot: true,
  url: null,
  x, y, width, height, rotation, zIndex,
  ...extra,
})

// Helper for a display text (Anton font)
const displayText = (text, opts = {}) => ({
  type: 'text',
  text,
  fontSize: 72,
  fontWeight: 'bold',
  fontFamily: 'display',
  color: '#FFFFFF',
  textAlign: 'center',
  rotation: 0,
  ...opts,
})

export const LAYOUT_PRESETS = [
  {
    id: 'blank',
    label: 'Blank',
    preview: '⬜',
    elements: [],
  },

  // ─── Covers ──────────────────────────────────────────────────────────────
  {
    id: 'cover-title-hero',
    label: 'Cover: Title + Hero',
    preview: '🅰️🖼️',
    group: 'cover',
    elements: [
      displayText('YOUR TITLE', { x: 40, y: 50, width: 720, height: 140, fontSize: 84, color: '#2D1B0E', zIndex: 1 }),
      slot(40, 210, 720, 350, 0, 2),
      displayText('2025', { x: 40, y: 470, width: 720, height: 100, fontSize: 56, color: '#C25A2E', zIndex: 3 }),
    ],
  },
  {
    id: 'cover-4grid',
    label: 'Cover: 4-Grid',
    preview: '🔲',
    group: 'cover',
    elements: [
      slot(40, 40, 360, 260, 0, 1),
      slot(410, 40, 350, 260, 0, 2),
      slot(40, 310, 360, 250, 0, 3),
      slot(410, 310, 350, 250, 0, 4),
      displayText('TITLE', { x: 40, y: 240, width: 720, height: 110, fontSize: 64, color: '#FFFFFF', zIndex: 5 }),
    ],
  },
  {
    id: 'cover-paris',
    label: 'Cover: Title Left',
    preview: '📸🅰️',
    group: 'cover',
    elements: [
      // Left: four photo slots
      slot(40, 60, 170, 200, 0, 1),
      slot(220, 60, 170, 200, 0, 2),
      slot(40, 270, 170, 200, 0, 3),
      slot(220, 270, 170, 200, 0, 4),
      // Right: big title (Anton) + year
      displayText('PARIS', { x: 400, y: 70, width: 380, height: 180, fontSize: 120, color: '#2D1B0E', textAlign: 'left', zIndex: 5 }),
      displayText('2025', { x: 400, y: 240, width: 380, height: 100, fontSize: 56, color: '#C25A2E', textAlign: 'left', zIndex: 6 }),
    ],
  },
  {
    id: 'cover-magazine',
    label: 'Cover: Magazine',
    preview: '📖',
    group: 'cover',
    elements: [
      displayText('TITLE', { x: 0, y: 30, width: 800, height: 200, fontSize: 160, color: '#FFFFFF', zIndex: 1 }),
      displayText('2025',  { x: 0, y: 210, width: 800, height: 80,  fontSize: 68,  color: '#E91E8C', zIndex: 2 }),
      slot(140, 275, 520, 295, 0, 3),
    ],
  },

  // ─── Spreads / Interior pages ───────────────────────────────────────────
  {
    id: 'spread-4top-2bottom',
    label: '4 Top / 2 Bottom',
    preview: '▪▪▪▪\n▬ ▬',
    group: 'spread',
    elements: [
      // Top row: four equal slots
      slot(40, 40, 170, 200, 0, 1),
      slot(225, 40, 170, 200, 0, 2),
      slot(410, 40, 170, 200, 0, 3),
      slot(595, 40, 165, 200, 0, 4),
      // Bottom row: two large slots
      slot(40, 260, 360, 300, 0, 5),
      slot(410, 260, 350, 300, 0, 6),
    ],
  },
  {
    id: 'two-col',
    label: '2 Column',
    preview: '⬛⬛',
    group: 'spread',
    elements: [
      slot(20, 20, 370, 560, 0, 1),
      slot(410, 20, 370, 560, 0, 2),
    ],
  },
  {
    id: 'six-grid',
    label: '6 Grid',
    preview: '⬛⬛⬛\n⬛⬛⬛',
    group: 'spread',
    elements: [
      slot(30, 30, 240, 260, 0, 1),
      slot(280, 30, 240, 260, 0, 2),
      slot(530, 30, 240, 260, 0, 3),
      slot(30, 310, 240, 260, 0, 4),
      slot(280, 310, 240, 260, 0, 5),
      slot(530, 310, 240, 260, 0, 6),
    ],
  },
  {
    id: 'strip',
    label: 'Strip',
    preview: '▪▪▪',
    group: 'spread',
    elements: [
      slot(20, 180, 240, 240, 0, 1),
      slot(280, 180, 240, 240, 0, 2),
      slot(540, 180, 240, 240, 0, 3),
    ],
  },
  {
    id: 'full-bleed',
    label: 'Full Bleed',
    preview: '🖼️',
    group: 'spread',
    elements: [
      slot(0, 0, 800, 600, 0, 1),
    ],
  },
  {
    id: 'photo-quote',
    label: 'Photo + Quote',
    preview: '📷✍️',
    group: 'spread',
    elements: [
      slot(20, 20, 380, 560, 0, 1),
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
  {
    id: 'hero-caption',
    label: 'Hero + Caption',
    preview: '🖼️🅰️',
    group: 'spread',
    elements: [
      slot(40, 40, 720, 400, 0, 1),
      displayText('MOMENT', { x: 40, y: 470, width: 720, height: 90, fontSize: 72, color: '#2D1B0E', zIndex: 2 }),
    ],
  },
  {
    id: 'polaroid-scatter',
    label: 'Polaroid Scatter',
    preview: '📸',
    group: 'spread',
    elements: [
      slot(60, 40, 280, 320, -8, 1, { polaroid: true }),
      slot(340, 70, 260, 300, 5, 2, { polaroid: true }),
      slot(190, 280, 240, 280, -3, 3, { polaroid: true }),
    ],
  },
]

// Default background presets (kept identical to previous editor behaviour)
export const BG_COLORS = [
  '#FDF6EC', '#FFFDF9', '#F5E6D0', '#FFF5F5', '#F0FFF4',
  '#EFF6FF', '#FAF5FF', '#FEFCE8', '#F8F8F8', '#2D1B0E',
  '#C25A2E', '#3B5E8A', '#4A7C59', '#7B3F6E', '#FBCFE8',
]
