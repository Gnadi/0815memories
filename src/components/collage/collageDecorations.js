// Vector decorations for collage templates — daisies, hearts, confetti, film
// sprockets, flower sprays, sparkles, colour fields.
//
// Everything is drawn with Canvas 2D from fractional coordinates, so a template
// looks the same at a 128 px gallery thumbnail and a 1600 px export, and the
// whole catalogue costs no image assets. Positions are fractions of the canvas
// (0–1); radii and stroke widths are fractions of the canvas *width*, so the
// art keeps its proportions on any aspect ratio.
//
// Randomness is seeded, never Math.random(): a template must look identical
// every time it is drawn, or the preview would not match the export.

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  ctx.beginPath()
  if (radius <= 0) {
    ctx.rect(x, y, w, h)
    return
  }
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius)
    return
  }
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

export { roundRectPath }

// ── Primitives ──────────────────────────────────────────────────────────────

// A daisy: rounded petals around a warm centre. The reference templates put
// these along the edges so they read as a frame rather than clutter.
function daisy(ctx, spec, { width, height }) {
  const {
    x, y, r = 0.06, petals = 8, rotation = 0,
    color = '#FFFFFF', centerColor = '#F6A723',
  } = spec
  const cx = x * width
  const cy = y * height
  const R = r * width

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.fillStyle = color
  for (let i = 0; i < petals; i++) {
    ctx.save()
    ctx.rotate((i * 2 * Math.PI) / petals)
    ctx.beginPath()
    ctx.ellipse(0, -R * 0.62, R * 0.24, R * 0.52, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.fillStyle = centerColor
  ctx.beginPath()
  ctx.arc(0, 0, R * 0.26, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function heartPath(ctx, R) {
  // Drawn around the origin, point-down, roughly 2R wide.
  ctx.beginPath()
  ctx.moveTo(0, R * 0.75)
  ctx.bezierCurveTo(-R * 1.5, -R * 0.2, -R * 0.6, -R * 1.25, 0, -R * 0.5)
  ctx.bezierCurveTo(R * 0.6, -R * 1.25, R * 1.5, -R * 0.2, 0, R * 0.75)
  ctx.closePath()
}

function heart(ctx, spec, { width, height }) {
  const {
    x, y, r = 0.05, rotation = 0,
    color = '#FF5A5F', outline = null, outlineWidth = 0.008,
  } = spec
  ctx.save()
  ctx.translate(x * width, y * height)
  ctx.rotate((rotation * Math.PI) / 180)
  heartPath(ctx, r * width)
  if (color) {
    ctx.fillStyle = color
    ctx.fill()
  }
  if (outline) {
    ctx.strokeStyle = outline
    ctx.lineWidth = outlineWidth * width
    ctx.lineJoin = 'round'
    ctx.stroke()
  }
  ctx.restore()
}

// Scattered dots. `area` limits them to part of the canvas so a template can
// keep the middle clear for the photo.
function confetti(ctx, spec, { width, height }) {
  const {
    seed = 1, count = 40,
    colors = ['#F4B942', '#EC5F6A', '#7FB069', '#5B8FD4'],
    minR = 0.006, maxR = 0.016,
    area = { x: 0, y: 0, w: 1, h: 1 },
    // Several regions scatter into the margin only — dots dropped on top of the
    // photo and then skipped left the corners bare.
    areas = null,
    avoid = null,
  } = spec
  const rand = mulberry32(seed)
  const regions = areas && areas.length > 0 ? areas : [area]

  for (let i = 0; i < count; i++) {
    const region = regions[Math.floor(rand() * regions.length) % regions.length]
    const fx = region.x + rand() * region.w
    const fy = region.y + rand() * region.h
    if (avoid &&
        fx > avoid.x && fx < avoid.x + avoid.w &&
        fy > avoid.y && fy < avoid.y + avoid.h) continue
    const r = (minR + rand() * (maxR - minR)) * width
    ctx.fillStyle = colors[Math.floor(rand() * colors.length) % colors.length]
    ctx.beginPath()
    ctx.arc(fx * width, fy * height, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

// A 35 mm film strip: the body plus two rows of sprocket holes. Photo slots sit
// on top of it, sharing its rotation.
function filmStrip(ctx, spec, { width, height }) {
  const {
    x, y, w, h, rotation = 0,
    color = '#FFFFFF', holeColor = '#D9D5CE',
    holes = 9, radius = 0.01,
  } = spec
  const px = x * width
  const py = y * height
  const pw = w * width
  const ph = h * height

  ctx.save()
  ctx.translate(px + pw / 2, py + ph / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.translate(-pw / 2, -ph / 2)

  ctx.fillStyle = color
  roundRectPath(ctx, 0, 0, pw, ph, radius * width)
  ctx.fill()

  // Sprockets run along the long edges, inside a rail the photo leaves clear
  // (see FILM_RAIL in collageTemplates) — otherwise the photo covers them and
  // the strip reads as a plain white rectangle.
  const vertical = ph >= pw
  const holeW = (vertical ? pw : ph) * 0.085
  const holeH = holeW * 1.5
  const gap = (vertical ? ph : pw) / (holes + 1)

  ctx.fillStyle = holeColor
  for (let i = 1; i <= holes; i++) {
    const along = gap * i
    if (vertical) {
      roundRectPath(ctx, pw * 0.028, along - holeH / 2, holeW, holeH, holeW * 0.28)
      ctx.fill()
      roundRectPath(ctx, pw - pw * 0.028 - holeW, along - holeH / 2, holeW, holeH, holeW * 0.28)
      ctx.fill()
    } else {
      roundRectPath(ctx, along - holeH / 2, ph * 0.028, holeH, holeW, holeW * 0.28)
      ctx.fill()
      roundRectPath(ctx, along - holeH / 2, ph - ph * 0.028 - holeW, holeH, holeW, holeW * 0.28)
      ctx.fill()
    }
  }
  ctx.restore()
}

// A stem with leaves and a few blooms — the doodle in the polaroid reference.
function flowerSpray(ctx, spec, { width, height }) {
  const {
    x, y, scale = 0.22, rotation = 0,
    petalColor = '#E98074', leafColor = '#A3B565', stemColor = '#8A7B3F',
    blooms = 3,
  } = spec
  const S = scale * width

  ctx.save()
  ctx.translate(x * width, y * height)
  ctx.rotate((rotation * Math.PI) / 180)

  // Stem
  ctx.strokeStyle = stemColor
  ctx.lineWidth = S * 0.035
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(S * 0.18, -S * 0.5, S * 0.05, -S)
  ctx.stroke()

  // Leaves
  ctx.fillStyle = leafColor
  for (const [t, dir] of [[0.32, 1], [0.62, -1]]) {
    const lx = S * 0.16 * t
    const ly = -S * t
    ctx.save()
    ctx.translate(lx, ly)
    ctx.rotate(dir * 0.9)
    ctx.beginPath()
    ctx.ellipse(dir * S * 0.16, 0, S * 0.18, S * 0.07, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Blooms along the top of the stem
  for (let b = 0; b < blooms; b++) {
    const t = 0.72 + b * 0.14
    const bx = S * 0.12 * t + (b - 1) * S * 0.2
    const by = -S * Math.min(1.05, t)
    ctx.save()
    ctx.translate(bx, by)
    ctx.rotate(b * 0.7)
    ctx.fillStyle = petalColor
    for (let p = 0; p < 5; p++) {
      ctx.save()
      ctx.rotate((p * 2 * Math.PI) / 5)
      ctx.beginPath()
      ctx.ellipse(0, -S * 0.12, S * 0.06, S * 0.12, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    ctx.restore()
  }

  ctx.restore()
}

// Four-point star / twinkle.
function sparkle(ctx, spec, { width, height }) {
  const { x, y, r = 0.04, rotation = 0, color = '#FFFFFF' } = spec
  const R = r * width
  ctx.save()
  ctx.translate(x * width, y * height)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, -R)
  ctx.quadraticCurveTo(R * 0.14, -R * 0.14, R, 0)
  ctx.quadraticCurveTo(R * 0.14, R * 0.14, 0, R)
  ctx.quadraticCurveTo(-R * 0.14, R * 0.14, -R, 0)
  ctx.quadraticCurveTo(-R * 0.14, -R * 0.14, 0, -R)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// A flat colour field — the curved blocks the "pop" references build on.
function band(ctx, spec, { width, height }) {
  const { x, y, w, h, radius = 0.1, color = '#FF5A5F', rotation = 0 } = spec
  ctx.save()
  ctx.translate(x * width, y * height)
  if (rotation) ctx.rotate((rotation * Math.PI) / 180)
  ctx.fillStyle = color
  roundRectPath(ctx, 0, 0, w * width, h * height, radius * width)
  ctx.fill()
  ctx.restore()
}

// A hand-drawn looking arc, used as an accent line next to a colour field.
function stroke(ctx, spec, { width, height }) {
  const { points = [], color = '#FFFFFF', lineWidth = 0.01, dash = null } = spec
  if (points.length < 2) return
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth * width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (dash) ctx.setLineDash(dash.map((d) => d * width))
  ctx.beginPath()
  ctx.moveTo(points[0][0] * width, points[0][1] * height)
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0] * width, points[i][1] * height)
  }
  ctx.stroke()
  ctx.restore()
}

export const DECORATION_PAINTERS = {
  daisy,
  heart,
  confetti,
  filmStrip,
  flowerSpray,
  sparkle,
  band,
  stroke,
}

/**
 * Paint one decoration. Unknown types are ignored rather than thrown, so an
 * older client rendering a newer template still produces a usable collage.
 */
export function paintDecoration(ctx, spec, size) {
  const painter = DECORATION_PAINTERS[spec?.type]
  if (!painter) return
  ctx.save()
  if (spec.opacity != null) ctx.globalAlpha = spec.opacity
  painter(ctx, spec, size)
  ctx.restore()
}

/**
 * Convenience for authoring: scatter one decoration type around the canvas
 * edges, leaving the middle for the photo.
 */
export function scatterEdge(type, count, base = {}, seed = 7) {
  const rand = mulberry32(seed)
  const out = []
  for (let i = 0; i < count; i++) {
    const edge = i % 4
    const along = 0.06 + rand() * 0.88
    const inset = 0.02 + rand() * 0.1
    const position =
      edge === 0 ? { x: along, y: inset } :
      edge === 1 ? { x: 1 - inset, y: along } :
      edge === 2 ? { x: along, y: 1 - inset } :
      { x: inset, y: along }
    out.push({ type, rotation: Math.round(rand() * 360), ...base, ...position })
  }
  return out
}
