/**
 * Text drawing for the scrapbook PDF export.
 *
 * html2canvas does not let the browser lay text out: it measures a font's
 * baseline with a hidden probe element and then paints every text node itself
 * at that offset. When the probe disagrees with the font's real metrics — as it
 * does for the Anton display face — every line is painted too low, which is how
 * a cover title that looks right in the editor ends up sitting on its subtitle
 * in the PDF. Drawing the glyphs ourselves onto a <canvas> keeps html2canvas out
 * of the business of placing them: it only copies finished pixels, the same way
 * the export already hands it photos.
 *
 * The maths here mirrors what CSS does for the editor's text boxes — a block of
 * line boxes, each `fontSize * lineHeight` tall, centred in the element the way
 * `flex items-center` centres them, with the glyphs sitting half a leading below
 * each line box's top.
 */

// The PDF capture rasterizes the page at this scale, so the export canvases use
// it as their backing-store ratio and map 1:1 into the captured bitmap.
export const EXPORT_PIXEL_RATIO = 2

// Used only when the browser reports no font bounding box (older Safari).
const FALLBACK_ASCENT_RATIO = 0.8
const FALLBACK_DESCENT_RATIO = 0.2

/**
 * Greedy word wrap against `maxWidth`, matching the editor's
 * `word-break: break-word`: words wrap at spaces, and a single word too wide
 * for the box is split mid-word rather than allowed to overflow.
 */
export function wrapLines(text, maxWidth, measure) {
  const source = String(text ?? '')
  if (!(maxWidth > 0)) return source.split('\n')

  const lines = []
  for (const paragraph of source.split('\n')) {
    let line = ''
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word
      if (!line || measure(candidate) <= maxWidth) {
        line = candidate
      } else {
        lines.push(line)
        line = word
      }
      while (measure(line) > maxWidth && line.length > 1) {
        let cut = line.length - 1
        while (cut > 1 && measure(line.slice(0, cut)) > maxWidth) cut--
        lines.push(line.slice(0, cut))
        line = line.slice(cut)
      }
    }
    lines.push(line)
  }
  return lines
}

/**
 * Where each line's glyphs go inside a `width` × `height` box. Returns the left
 * edge and the baseline of every line, in CSS pixels relative to the box.
 *
 * For a single line the leading cancels out, so the result only depends on the
 * font's own ascent and descent — which is why this lands on the same pixels as
 * the browser's own centring however the line height is set.
 */
export function layoutTextBlock({
  lines,
  width,
  height,
  fontSize,
  lineHeight = 1.25,
  ascent,
  descent,
  textAlign = 'center',
  measure,
}) {
  const lineHeightPx = fontSize * lineHeight
  const glyphAscent = Number.isFinite(ascent) ? ascent : fontSize * FALLBACK_ASCENT_RATIO
  const glyphDescent = Number.isFinite(descent) ? descent : fontSize * FALLBACK_DESCENT_RATIO
  const halfLeading = (lineHeightPx - (glyphAscent + glyphDescent)) / 2
  const top = (height - lines.length * lineHeightPx) / 2

  return lines.map((text, i) => {
    const lineWidth = measure(text)
    const x = textAlign === 'left'
      ? 0
      : textAlign === 'right'
        ? width - lineWidth
        : (width - lineWidth) / 2
    return { text, x, baseline: top + i * lineHeightPx + halfLeading + glyphAscent }
  })
}

/**
 * Paint `text` into the `width` × `height` box whose top-left corner sits at
 * (offsetX, offsetY) on `ctx`. The context is expected to already be scaled to
 * CSS pixels.
 */
export function drawTextBlock(ctx, {
  text,
  width,
  height,
  offsetX = 0,
  offsetY = 0,
  fontSize,
  fontFamily,
  fontWeight = 'normal',
  color = '#000000',
  textAlign = 'center',
  lineHeight = 1.25,
  letterSpacing = 0,
}) {
  ctx.save()
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = color

  // Chrome and recent Safari space letters for us; elsewhere we advance the
  // pen by hand so the line keeps the width the editor gave it.
  const wantsSpacing = Math.abs(letterSpacing) > 0.01
  const nativeSpacing = wantsSpacing && 'letterSpacing' in ctx
  if (nativeSpacing) ctx.letterSpacing = `${letterSpacing}px`
  const manualSpacing = wantsSpacing && !nativeSpacing
  const measure = (value) => ctx.measureText(value).width
    + (manualSpacing ? letterSpacing * [...value].length : 0)

  const probe = ctx.measureText('Hg')
  const laidOut = layoutTextBlock({
    lines: wrapLines(text, width, measure),
    width,
    height,
    fontSize,
    lineHeight,
    ascent: probe.fontBoundingBoxAscent,
    descent: probe.fontBoundingBoxDescent,
    textAlign,
    measure,
  })

  for (const line of laidOut) {
    const y = offsetY + line.baseline
    if (manualSpacing) {
      let pen = offsetX + line.x
      for (const char of line.text) {
        ctx.fillText(char, pen, y)
        pen += ctx.measureText(char).width + letterSpacing
      }
    } else {
      ctx.fillText(line.text, offsetX + line.x, y)
    }
  }

  ctx.restore()
}

/**
 * Size a canvas to `cssWidth` × `cssHeight` at the export backing-store ratio
 * and return a context scaled so callers can draw in CSS pixels.
 */
export function prepareExportCanvas(canvas, cssWidth, cssHeight, ratio = EXPORT_PIXEL_RATIO) {
  canvas.width = Math.max(1, Math.round(cssWidth * ratio))
  canvas.height = Math.max(1, Math.round(cssHeight * ratio))
  const ctx = canvas.getContext('2d')
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  return ctx
}
