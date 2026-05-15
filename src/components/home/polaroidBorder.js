export const POLAROID_BORDER_DEFAULTS = {
  color: '#FFFDF9',
  width: 'medium',
  style: 'solid',
  decoration: 'none',
  frameTheme: 'solid',
  customImageUrl: '',
  customImagePublicId: '',
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

export const POLAROID_FRAME_THEMES = [
  { id: 'solid', label: 'Solid' },
  { id: 'dots', label: 'Dots' },
  { id: 'stripes', label: 'Stripes' },
  { id: 'confetti', label: 'Confetti' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'custom', label: 'Custom' },
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

const FRAME_PATTERN_CSS = {
  dots: {
    image: (frameColor) => {
      const dot = isLightPolaroidColor(frameColor) ? 'rgba(45, 27, 14, 0.35)' : 'rgba(253, 246, 236, 0.45)'
      return `radial-gradient(circle, ${dot} 1.2px, transparent 1.6px)`
    },
    size: '12px 12px',
  },
  stripes: {
    image: (frameColor) => {
      const line = isLightPolaroidColor(frameColor) ? 'rgba(45, 27, 14, 0.22)' : 'rgba(253, 246, 236, 0.32)'
      return `repeating-linear-gradient(45deg, ${line} 0 2px, transparent 2px 14px)`
    },
    size: 'auto',
  },
  confetti: {
    image: (frameColor) => {
      const light = isLightPolaroidColor(frameColor)
      const a = light ? 'rgba(194, 90, 46, 0.55)' : 'rgba(212, 120, 74, 0.65)'
      const b = light ? 'rgba(59, 94, 138, 0.45)' : 'rgba(170, 200, 230, 0.55)'
      const c = light ? 'rgba(74, 124, 89, 0.45)' : 'rgba(170, 210, 180, 0.5)'
      return (
        `radial-gradient(circle at 20% 30%, ${a} 1.6px, transparent 2.4px), ` +
        `radial-gradient(circle at 70% 60%, ${b} 1.6px, transparent 2.4px), ` +
        `radial-gradient(circle at 45% 85%, ${c} 1.6px, transparent 2.4px)`
      )
    },
    size: '22px 22px, 26px 26px, 30px 30px',
  },
  vintage: {
    image: (frameColor) => {
      const light = isLightPolaroidColor(frameColor)
      const line = light ? 'rgba(122, 106, 94, 0.18)' : 'rgba(253, 246, 236, 0.18)'
      const grain = light ? 'rgba(45, 27, 14, 0.12)' : 'rgba(253, 246, 236, 0.18)'
      return (
        `repeating-linear-gradient(0deg, ${line} 0 1px, transparent 1px 4px), ` +
        `radial-gradient(circle at 30% 40%, ${grain} 0.6px, transparent 1px)`
      )
    },
    size: 'auto, 6px 6px',
  },
}

export function getPolaroidFrameStyle(border) {
  return { backgroundColor: border.color }
}

export function getPolaroidFramePattern(border) {
  if (border.frameTheme === 'custom' && border.customImageUrl) {
    return {
      backgroundImage: `url("${border.customImageUrl}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }
  }
  const pattern = FRAME_PATTERN_CSS[border.frameTheme]
  if (pattern) {
    return {
      backgroundImage: pattern.image(border.color),
      backgroundSize: pattern.size,
    }
  }
  return null
}
