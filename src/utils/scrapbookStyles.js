/**
 * The visual vocabulary of a scrapbook page, in one place.
 *
 * Three things draw the same page now — the editor's DOM, the screen PDF
 * export's capture canvases, and the print renderer — and the only reason they
 * agree on what a page looks like is that they read their fonts, line heights
 * and polaroid metrics from here. A number that lives in only one of them is a
 * number the printed book will disagree with.
 *
 * Everything is expressed in *design pixels*: the 800 × 600 coordinate system
 * the editor stores element geometry in. The print renderer scales that whole
 * space up to 300 DPI, so a value written here is resolution-independent.
 */

/** The editor's canvas, and therefore the coordinate system `pages` is stored in. */
export const DESIGN_WIDTH = 800
export const DESIGN_HEIGHT = 600

export const FONT_STACKS = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: 'system-ui, -apple-system, sans-serif',
  mono: 'ui-monospace, monospace',
  display: "'Anton', 'Impact', 'Arial Narrow', sans-serif",
}

// Display type (Anton) is tracked out slightly and gets more line spacing than
// the text faces, in the editor and in every export alike.
export const DISPLAY_LETTER_SPACING_EM = 0.02
export const DISPLAY_LINE_HEIGHT = 1.35
export const TEXT_LINE_HEIGHT = 1.25

/**
 * Stickers are emoji, which the editor renders in whatever face the page
 * inherits. An offscreen print canvas inherits nothing, so it needs the stack
 * spelled out — otherwise the glyphs fall back to a monochrome outline face and
 * the printed book loses every colour emoji.
 */
export const EMOJI_FONT_STACK =
  "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', system-ui, sans-serif"

/** Default text colour, matching `--color-bark`. */
export const TEXT_COLOR = '#2D1B0E'
/** Polaroid caption colour, matching `--color-bark-muted`. */
export const CAPTION_COLOR = '#736150'

export const DEFAULT_PAGE_BACKGROUND = '#FDF6EC'

/**
 * The polaroid frame, as Tailwind lays it out in the editor
 * (`bg-white p-2 pb-6`, caption `text-xs mt-1 px-1`). The print renderer
 * reproduces this box model by hand, so the numbers have to be the real ones.
 */
export const POLAROID = {
  padding: 8, // p-2
  paddingBottom: 24, // pb-6
  captionFontSize: 12, // text-xs
  captionLineHeight: 16, // text-xs line-height
  captionMarginTop: 4, // mt-1
  captionPaddingX: 4, // px-1
  shadow: { color: 'rgba(0, 0, 0, 0.10)', blur: 6, offsetY: 4 },
}

/** `rounded` on a bare (non-polaroid) photo. */
export const PHOTO_CORNER_RADIUS = 4

/**
 * Background patterns, as geometry rather than as CSS gradients.
 *
 * The editor paints these with `background-image`, which the print renderer has
 * no equivalent for. Each entry restates the same pattern as a tile the
 * renderer can stamp: `tile` is the repeat in design pixels, the rest describes
 * what to draw inside one tile. Keep these in step with `PATTERNS` in
 * ScrapbookCanvas.
 */
export const BACKGROUND_PATTERNS = {
  none: null,
  // radial-gradient(circle, #c8b9a8 1px, transparent 1px) / 20px 20px
  dots: { kind: 'dot', color: '#c8b9a8', tile: { w: 20, h: 20 }, radius: 1 },
  // two 1px linear-gradients / 40px 40px
  grid: { kind: 'grid', color: '#dddddd', tile: { w: 40, h: 40 }, thickness: 1 },
  // repeating-linear-gradient(0deg, transparent 23px, #ddd 24px) / 100% 24px
  lines: { kind: 'hline', color: '#dddddd', tile: { w: 0, h: 24 }, offset: 23, thickness: 1 },
}

/**
 * Resolve an element's text styling the way the editor does, so the export
 * paints the glyphs the user actually placed.
 *
 * `type` decides more than the content: stickers ignore the font controls
 * entirely and are always centred emoji at their own size.
 */
export function resolveTextStyle(element) {
  const isSticker = element.type === 'sticker'
  const isDisplay = element.fontFamily === 'display'
  const fontSize = isSticker ? element.stickerSize || 48 : element.fontSize || 20

  return {
    text: isSticker ? element.emoji || '' : element.text || '',
    fontSize,
    fontFamily: isSticker ? EMOJI_FONT_STACK : FONT_STACKS[element.fontFamily] || FONT_STACKS.display,
    fontWeight: isSticker ? 'normal' : element.fontWeight || 'normal',
    color: element.color || TEXT_COLOR,
    textAlign: isSticker ? 'center' : element.textAlign || 'center',
    lineHeight: isDisplay && !isSticker ? DISPLAY_LINE_HEIGHT : TEXT_LINE_HEIGHT,
    letterSpacing: !isSticker && isDisplay ? fontSize * DISPLAY_LETTER_SPACING_EM : 0,
  }
}

/**
 * Where a polaroid's photo and caption sit inside its element box.
 *
 * Mirrors the flex column in CanvasElement: fixed padding, the caption taking
 * its line box plus its top margin, and the photo taking whatever is left.
 */
export function polaroidLayout(width, height, { hasCaption = false } = {}) {
  const captionBlock = hasCaption ? POLAROID.captionLineHeight + POLAROID.captionMarginTop : 0
  const photo = {
    x: POLAROID.padding,
    y: POLAROID.padding,
    width: Math.max(0, width - POLAROID.padding * 2),
    height: Math.max(0, height - POLAROID.padding - POLAROID.paddingBottom - captionBlock),
  }
  const caption = hasCaption
    ? {
        x: POLAROID.padding + POLAROID.captionPaddingX,
        y: photo.y + photo.height + POLAROID.captionMarginTop,
        width: Math.max(0, width - (POLAROID.padding + POLAROID.captionPaddingX) * 2),
        height: POLAROID.captionLineHeight,
      }
    : null

  return { photo, caption }
}
