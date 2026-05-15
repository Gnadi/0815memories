export const POLAROID_BORDER_DEFAULTS = {
  color: '#FFFDF9',
  width: 'medium',
  style: 'solid',
  decoration: 'none',
}

export const POLAROID_COLORS = ['#FFFDF9', '#FDF6EC', '#F5E6D0', '#2D1B0E', '#C25A2E', '#3B5E8A', '#7B3F6E']

export const POLAROID_WIDTHS = [
  { id: 'thin', label: 'Thin' },
  { id: 'medium', label: 'Medium' },
  { id: 'thick', label: 'Thick' },
]

export const POLAROID_STYLES = [
  { id: 'solid', label: 'Solid' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'double', label: 'Double' },
]

export const POLAROID_DECORATIONS = [
  { id: 'none', label: 'None' },
  { id: 'tape', label: 'Tape' },
  { id: 'corners', label: 'Corners' },
]

export function resolvePolaroidBorder(value) {
  return { ...POLAROID_BORDER_DEFAULTS, ...(value || {}) }
}

export function isLightPolaroidColor(hex) {
  if (!hex || hex[0] !== '#') return true
  const rgb = parseInt(hex.slice(1), 16)
  const r = (rgb >> 16) & 0xff
  const g = (rgb >> 8) & 0xff
  const b = rgb & 0xff
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55
}
