// Layout preset element definitions for the scrapbook editor.
// Coordinates are calibrated for the 1200×600 two-page spread canvas
// (left page: x 0..600, right page: x 600..1200).

// Paris-style cover layout — back cover on left half (2×2 photo grid + small
// PARIS 2025 caption), front cover on right half (huge PARIS headline + 2025
// accent). No baked-in image on the front; the user drops their own
// decorative photo/sticker into the empty lower-right area.
export const PARIS_COVER_ELEMENTS = [
  // Back cover — 2×2 photo grid
  { type: 'photo', x: 60, y: 60, width: 210, height: 210, rotation: 0, zIndex: 1 },
  { type: 'photo', x: 330, y: 60, width: 210, height: 210, rotation: 0, zIndex: 2 },
  { type: 'photo', x: 60, y: 330, width: 210, height: 210, rotation: 0, zIndex: 3 },
  { type: 'photo', x: 330, y: 330, width: 210, height: 210, rotation: 0, zIndex: 4 },
  // Back cover — small caption
  {
    type: 'text',
    x: 40, y: 470, width: 300, height: 60, rotation: 0, zIndex: 5,
    text: 'PARIS',
    fontSize: 56, fontFamily: 'display', fontWeight: 'bold',
    color: '#2D1B0E', textAlign: 'left',
  },
  {
    type: 'text',
    x: 40, y: 525, width: 200, height: 50, rotation: 0, zIndex: 6,
    text: '2025',
    fontSize: 36, fontFamily: 'display', fontWeight: 'bold',
    color: '#C25A2E', textAlign: 'left',
  },
  // Front cover — huge headline
  {
    type: 'text',
    x: 640, y: 30, width: 540, height: 200, rotation: 0, zIndex: 7,
    text: 'PARIS',
    fontSize: 180, fontFamily: 'display', fontWeight: 'bold',
    color: '#2D1B0E', textAlign: 'center',
  },
  {
    type: 'text',
    x: 980, y: 215, width: 200, height: 60, rotation: 0, zIndex: 8,
    text: '2025',
    fontSize: 56, fontFamily: 'display', fontWeight: 'bold',
    color: '#C25A2E', textAlign: 'right',
  },
]
