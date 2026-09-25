/**
 * Draws a "Sky of your birth" poster onto a Canvas 2D context.
 *
 * One renderer for everything — the on-screen preview, the PNG / PDF download
 * and the image posted to the feed are the same pixels at different sizes, the
 * way collageRenderer.js does it for collages. It knows nothing about i18n:
 * the page hands in finished caption strings and compass letters.
 */
import { project } from './astronomy'

/** Poster proportions: ISO 216 paper, 1 : √2. */
export const POSTER_RATIO = Math.SQRT2

export const SKY_STYLES = {
  midnight: {
    background: ['#1B2A4A', '#0B1428'],
    disc: '#08111F',
    edge: '#D9B26F',
    star: '#FFFFFF',
    tintStars: true,
    line: 'rgba(217, 178, 111, 0.5)',
    label: 'rgba(244, 235, 221, 0.62)',
    planet: '#F2C46D',
    moonLit: '#F7F1E3',
    moonDark: '#253047',
    text: '#F4EBDD',
    muted: 'rgba(244, 235, 221, 0.72)',
  },
  kaydo: {
    background: ['#FFFDF9', '#FDF6EC'],
    disc: '#F5E6D0',
    edge: '#C25A2E',
    star: '#2D1B0E',
    tintStars: false,
    line: 'rgba(194, 90, 46, 0.7)',
    label: 'rgba(160, 68, 32, 0.8)',
    planet: '#C25A2E',
    moonLit: '#FFFDF9',
    moonDark: '#E3CDAE',
    text: '#2D1B0E',
    muted: '#736150',
  },
  minimal: {
    background: ['#FFFFFF', '#FFFFFF'],
    disc: '#FFFFFF',
    edge: '#111111',
    star: '#111111',
    tintStars: false,
    line: 'rgba(17, 17, 17, 0.45)',
    label: 'rgba(17, 17, 17, 0.6)',
    planet: '#111111',
    moonLit: '#FFFFFF',
    moonDark: '#CFCFCF',
    text: '#111111',
    muted: '#555555',
  },
}

const DISPLAY_FONT = "'Anton', 'Impact', 'Arial Narrow', sans-serif"
const SERIF_FONT = "Georgia, 'Times New Roman', serif"

// Star colour from its B–V index: blue-white hot stars to orange cool ones.
function starTint(bv) {
  if (bv < 0) return '#C4D6FF'
  if (bv < 0.4) return '#EEF2FF'
  if (bv < 0.8) return '#FFF8EA'
  if (bv < 1.3) return '#FFE6C2'
  return '#FFD0A0'
}

function starRadius(mag, unit) {
  return unit * (0.6 + 0.55 * Math.pow(Math.max(0, 6.2 - mag), 1.25))
}

function starAlpha(mag) {
  return Math.min(1, Math.max(0.4, 0.4 + (6.2 - mag) / 6))
}

/**
 * The moon in its phase, with the lit limb turned toward the sun. `k` is the
 * illuminated fraction. Works in a frame rotated so the sun lies along +x:
 * the right half of the disc is lit, and an ellipse of half-width |1 − 2k|
 * either eats into it (crescent) or adds to it (gibbous).
 */
function drawMoon(ctx, x, y, radius, k, sunAngle, style) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(sunAngle)

  ctx.fillStyle = style.moonDark
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = style.moonLit
  ctx.beginPath()
  ctx.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2, false)
  ctx.ellipse(0, 0, Math.abs(1 - 2 * k) * radius, radius, 0, Math.PI / 2, -Math.PI / 2, k < 0.5)
  ctx.fill()

  ctx.strokeStyle = style.edge
  ctx.lineWidth = Math.max(1, radius * 0.08)
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function drawSpacedText(ctx, text, x, y, spacing) {
  // Canvas letterSpacing is not everywhere yet; fall back to drawing it plain.
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${spacing}px`
    ctx.fillText(text, x, y)
    ctx.letterSpacing = '0px'
  } else {
    ctx.fillText(text, x, y)
  }
}

function fitFont(ctx, text, family, size, maxWidth, weight = '') {
  let s = size
  ctx.font = `${weight} ${s}px ${family}`
  while (s > 8 && ctx.measureText(text).width > maxWidth) {
    s -= 1
    ctx.font = `${weight} ${s}px ${family}`
  }
  return s
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} opts
 * @param {number} opts.width   poster width in px; height is width × √2
 * @param {object} opts.sky     result of computeSky()
 * @param {string} opts.style   key of SKY_STYLES
 * @param {object} opts.caption { title, lines: string[] }
 * @param {object} opts.compass { n, e, s, w } letters
 * @param {string} opts.lang    'en' | 'de' — which constellation names
 * @param {object} opts.planetNames  body → localized name
 */
export function drawSkyPoster(ctx, { width, sky, style: styleKey, caption, compass, lang, planetNames = {} }) {
  const style = SKY_STYLES[styleKey] || SKY_STYLES.midnight
  const height = Math.round(width * POSTER_RATIO)

  // Paper
  const bg = ctx.createLinearGradient(0, 0, 0, height)
  bg.addColorStop(0, style.background[0])
  bg.addColorStop(1, style.background[1])
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  const margin = width * 0.1
  const R = (width - margin * 2) / 2
  const cx = width / 2
  const cy = margin * 1.6 + R
  const unit = R / 500
  const toCanvas = ({ alt, az }) => {
    const p = project(Math.max(alt, -85), az)
    return [cx + p.x * R, cy + p.y * R]
  }

  // Disc
  ctx.fillStyle = style.disc
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.clip()

  if (sky) {
    // Constellation lines. A segment is drawn when at least one end is above
    // the horizon — the clip trims the rest — and skipped when both ends are
    // far below, where the projection stretches toward infinity.
    ctx.strokeStyle = style.line
    ctx.lineWidth = Math.max(1, unit * 1.3)
    ctx.lineCap = 'round'
    for (const c of sky.constellations) {
      for (const line of c.lines) {
        for (let i = 1; i < line.length; i++) {
          const a = line[i - 1]
          const b = line[i]
          if (a.alt < -10 && b.alt < -10) continue
          if (a.alt < 0 && b.alt < 0) continue
          const [x1, y1] = toCanvas(a)
          const [x2, y2] = toCanvas(b)
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
        }
      }
    }

    // Stars — faintest first, so bright stars sit on top.
    for (const s of sky.stars) {
      if (s.alt < -1) continue
      const [x, y] = toCanvas(s)
      ctx.globalAlpha = starAlpha(s.mag)
      ctx.fillStyle = style.tintStars ? starTint(s.bv) : style.star
      ctx.beginPath()
      ctx.arc(x, y, starRadius(s.mag, unit), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Constellation names, only the well-known ones to keep the map calm.
    ctx.fillStyle = style.label
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `${Math.round(unit * 11)}px ${SERIF_FONT}`
    for (const c of sky.constellations) {
      if (c.rank > 1 || c.label.alt < 8) continue
      const [x, y] = toCanvas(c.label)
      drawSpacedText(ctx, (c.name[lang] || c.name.en).toUpperCase(), x, y, unit * 2)
    }

    // Planets
    for (const p of sky.planets) {
      if (p.alt < 0) continue
      const [x, y] = toCanvas(p)
      ctx.fillStyle = style.planet
      ctx.beginPath()
      ctx.arc(x, y, unit * 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.font = `italic ${Math.round(unit * 13)}px ${SERIF_FONT}`
      ctx.textAlign = 'left'
      ctx.fillText(planetNames[p.body] || p.body, x + unit * 9, y)
    }

    // Moon
    if (sky.moon.alt > -1) {
      const [mx, my] = toCanvas(sky.moon)
      const [sx, sy] = toCanvas(sky.sun)
      drawMoon(ctx, mx, my, unit * 16, sky.moon.illumination, Math.atan2(sy - my, sx - mx), style)
    }
  }
  ctx.restore()

  // Horizon ring and compass
  ctx.strokeStyle = style.edge
  ctx.lineWidth = Math.max(1.5, unit * 3)
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = Math.max(1, unit)
  ctx.beginPath()
  ctx.arc(cx, cy, R + unit * 12, 0, Math.PI * 2)
  ctx.stroke()

  if (compass) {
    ctx.fillStyle = style.edge
    ctx.font = `${Math.round(unit * 16)}px ${SERIF_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const o = R + unit * 30
    ctx.fillText(compass.n, cx, cy - o)
    ctx.fillText(compass.s, cx, cy + o)
    ctx.fillText(compass.e, cx - o, cy) // east on the left: looking up, not down
    ctx.fillText(compass.w, cx + o, cy)
  }

  // Caption
  const textTop = cy + R + unit * 90
  const maxText = width - margin * 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  if (caption?.title) {
    ctx.fillStyle = style.text
    const size = fitFont(ctx, caption.title.toUpperCase(), DISPLAY_FONT, Math.round(unit * 56), maxText)
    drawSpacedText(ctx, caption.title.toUpperCase(), cx, textTop, size * 0.08)
  }
  let y = textTop + unit * 52
  ctx.fillStyle = style.muted
  for (const line of caption?.lines || []) {
    if (!line) continue
    fitFont(ctx, line, SERIF_FONT, Math.round(unit * 19), maxText)
    ctx.fillText(line, cx, y)
    y += unit * 32
  }

  return { width, height }
}

/** Renders a poster into a fresh canvas `width` px wide. */
export function renderSkyPosterCanvas(width, opts) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = Math.round(width * POSTER_RATIO)
  drawSkyPoster(canvas.getContext('2d'), { ...opts, width })
  return canvas
}
