// Structured login-page theme for the non-technical customization tier.
// A theme is plain data on the world-readable family doc, so every field is
// validated here before it becomes a style — a malformed doc must never
// break the login page.

export const THEME_FONTS = {
  default: '',
  playful: "'Comic Sans MS', 'Comic Sans', 'Chalkboard SE', cursive",
  elegant: "Georgia, 'Times New Roman', serif",
  retro: "'Courier New', Courier, monospace",
}

export const THEME_DECORATIONS = {
  none: [],
  hearts: ['❤️', '\u{1F495}', '\u{1F49B}'],
  stars: ['⭐', '\u{1F31F}', '✨'],
  sparkles: ['✨', '\u{1F4AB}', '\u{1F308}'],
  flowers: ['\u{1F33C}', '\u{1F337}', '\u{1F33B}'],
}

export const LOGIN_THEME_PRESETS = {
  sunset: {
    preset: 'sunset',
    background: { type: 'gradient', from: '#ff9a56', to: '#ff5e8a', angle: 160 },
    font: 'default',
    textColor: '#4a1d33',
    accentColor: '#c2185b',
    decorations: 'hearts',
  },
  space: {
    preset: 'space',
    background: { type: 'gradient', from: '#0b0d2a', to: '#3b1d60', angle: 180 },
    font: 'retro',
    textColor: '#e8e6ff',
    accentColor: '#8e7bff',
    decorations: 'stars',
  },
  garden: {
    preset: 'garden',
    background: { type: 'gradient', from: '#d4f5c9', to: '#7fd8a8', angle: 135 },
    font: 'elegant',
    textColor: '#1f4d2e',
    accentColor: '#2e7d4f',
    decorations: 'flowers',
  },
  retro: {
    preset: 'retro',
    background: { type: 'gradient', from: '#fdf3c7', to: '#f9c74f', angle: 145 },
    font: 'playful',
    textColor: '#5b3a1e',
    accentColor: '#d35400',
    decorations: 'none',
  },
  glitter: {
    preset: 'glitter',
    background: { type: 'gradient', from: '#fbc2eb', to: '#a6c1ee', angle: 120 },
    font: 'playful',
    textColor: '#4a2c5e',
    accentColor: '#9b59b6',
    decorations: 'sparkles',
  },
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

function safeColor(value, fallback) {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value : fallback
}

function safeUrl(value) {
  if (typeof value !== 'string') return ''
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : ''
  } catch {
    return ''
  }
}

function backgroundStyle(background) {
  if (!background || typeof background !== 'object') return {}
  if (background.type === 'color') {
    return { background: safeColor(background.color, '#fdf8f0') }
  }
  if (background.type === 'gradient') {
    const from = safeColor(background.from, '#fdf8f0')
    const to = safeColor(background.to, '#f5e9d7')
    const angle = Number.isFinite(Number(background.angle))
      ? Math.max(0, Math.min(360, Number(background.angle)))
      : 160
    return { background: `linear-gradient(${angle}deg, ${from}, ${to})` }
  }
  if (background.type === 'image') {
    const url = safeUrl(background.imageUrl)
    if (!url) return {}
    return {
      backgroundImage: `url("${url}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  return {}
}

// Maps a stored theme config to inline styles for the login page. Every
// output is derived through a validator, so arbitrary doc contents can only
// ever produce colors, a gradient, an https image URL, or a curated font.
export function themeToStyles(theme) {
  const t = theme && typeof theme === 'object' ? theme : {}
  const fontFamily = THEME_FONTS[t.font] || ''
  const textColor = safeColor(t.textColor, '')
  const accentColor = safeColor(t.accentColor, '')

  const pageStyle = backgroundStyle(t.background)
  if (fontFamily) pageStyle.fontFamily = fontFamily

  const headingStyle = {}
  const textStyle = {}
  if (textColor) {
    headingStyle.color = textColor
    textStyle.color = textColor
    textStyle.opacity = 0.85
  }

  return { pageStyle, headingStyle, textStyle, accentColor }
}

export function themeDecorationEmojis(theme) {
  const key = theme && typeof theme === 'object' ? theme.decorations : 'none'
  return THEME_DECORATIONS[key] || []
}

export function themeText(theme, field) {
  const value = theme && typeof theme === 'object' ? theme[field] : ''
  return typeof value === 'string' ? value.slice(0, 200).trim() : ''
}
