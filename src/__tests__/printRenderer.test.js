import { describe, it, expect } from 'vitest'
import { drawPrintPage } from '../utils/printRenderer'
import { DESIGN_WIDTH, DESIGN_HEIGHT, POLAROID } from '../utils/scrapbookStyles'

/**
 * A 2D context that records what it was asked to draw.
 *
 * jsdom has no canvas, and the interesting part of the print renderer is not
 * the pixels but the decisions: what gets drawn at all, in what order, and
 * around which point a rotated element turns. Those are all visible in the call
 * log.
 */
function recordingContext() {
  const calls = []
  const record = (name) => (...args) => { calls.push({ name, args }) }

  const ctx = {
    calls,
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    rotate: record('rotate'),
    scale: record('scale'),
    setTransform: record('setTransform'),
    fillRect: record('fillRect'),
    rect: record('rect'),
    roundRect: record('roundRect'),
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    moveTo: record('moveTo'),
    arcTo: record('arcTo'),
    arc: record('arc'),
    fill: record('fill'),
    clip: record('clip'),
    drawImage: record('drawImage'),
    fillText: record('fillText'),
    measureText: (text) => ({
      // Enough for the wrap/centre maths to run without dividing by zero.
      width: String(text).length * 8,
      fontBoundingBoxAscent: 16,
      fontBoundingBoxDescent: 4,
    }),
  }
  return ctx
}

const image = (w = 2000, h = 1500) => ({ naturalWidth: w, naturalHeight: h })

const of = (ctx, name) => ctx.calls.filter((c) => c.name === name)

describe('drawPrintPage', () => {
  it('fills the whole page with its background colour', () => {
    const ctx = recordingContext()
    drawPrintPage(ctx, { backgroundColor: '#112233', elements: [] })
    expect(of(ctx, 'fillRect')[0].args).toEqual([0, 0, DESIGN_WIDTH, DESIGN_HEIGHT])
  })

  it('stamps the dot pattern across the page', () => {
    const ctx = recordingContext()
    drawPrintPage(ctx, { backgroundPattern: 'dots', elements: [] })
    // 40 columns × 30 rows on a 20 px tile.
    expect(of(ctx, 'arc')).toHaveLength((DESIGN_WIDTH / 20) * (DESIGN_HEIGHT / 20))
  })

  it('draws the ruled-lines pattern at the offset the CSS gradient uses', () => {
    const ctx = recordingContext()
    drawPrintPage(ctx, { backgroundPattern: 'lines', elements: [] })
    const lines = of(ctx, 'fillRect').slice(1) // first is the background
    expect(lines[0].args[1]).toBe(23)
    expect(lines[1].args[1]).toBe(47)
  })

  it('draws nothing at all for an unfilled photo slot', () => {
    const ctx = recordingContext()
    drawPrintPage(ctx, {
      elements: [{ id: 's', type: 'photo', url: null, x: 0, y: 0, width: 100, height: 100 }],
    })
    expect(of(ctx, 'drawImage')).toHaveLength(0)
  })

  it('skips a photo whose image never loaded rather than aborting the page', () => {
    const ctx = recordingContext()
    drawPrintPage(ctx, {
      elements: [{ id: 'p', type: 'photo', url: 'enc://a', x: 0, y: 0, width: 100, height: 100 }],
    }, new Map())
    expect(of(ctx, 'drawImage')).toHaveLength(0)
    // The background still got painted, so the page is a page.
    expect(of(ctx, 'fillRect').length).toBeGreaterThan(0)
  })

  it('draws elements bottom-up by zIndex, not in array order', () => {
    const ctx = recordingContext()
    drawPrintPage(ctx, {
      elements: [
        { id: 'top', type: 'text', text: 'B', zIndex: 5, x: 0, y: 0, width: 100, height: 40 },
        { id: 'bottom', type: 'text', text: 'A', zIndex: 1, x: 0, y: 0, width: 100, height: 40 },
      ],
    })
    const drawn = of(ctx, 'fillText').map((c) => c.args[0])
    expect(drawn).toEqual(['A', 'B'])
  })

  it('rotates an element about its own centre', () => {
    const ctx = recordingContext()
    drawPrintPage(ctx, {
      elements: [{ id: 'p', type: 'photo', url: 'enc://a', x: 100, y: 50, width: 200, height: 100, rotation: 30 }],
    }, new Map([['enc://a', image()]]))

    const translates = of(ctx, 'translate')
    expect(translates[0].args).toEqual([200, 100]) // x + w/2, y + h/2
    expect(of(ctx, 'rotate')[0].args[0]).toBeCloseTo(Math.PI / 6, 6)
    expect(translates[1].args).toEqual([-100, -50]) // back to the box's corner
  })

  it('does not rotate an element that has no rotation', () => {
    const ctx = recordingContext()
    drawPrintPage(ctx, {
      elements: [{ id: 'p', type: 'photo', url: 'enc://a', x: 0, y: 0, width: 100, height: 100 }],
    }, new Map([['enc://a', image()]]))
    expect(of(ctx, 'rotate')).toHaveLength(0)
  })

  it('clips a bare photo to rounded corners', () => {
    const ctx = recordingContext()
    drawPrintPage(ctx, {
      elements: [{ id: 'p', type: 'photo', url: 'enc://a', x: 0, y: 0, width: 200, height: 100 }],
    }, new Map([['enc://a', image()]]))
    expect(of(ctx, 'roundRect')).toHaveLength(1)
    expect(of(ctx, 'clip')).toHaveLength(1)
    expect(of(ctx, 'drawImage')).toHaveLength(1)
  })

  it('gives a polaroid its white card and insets the photo by the frame', () => {
    const ctx = recordingContext()
    drawPrintPage(ctx, {
      elements: [{ id: 'p', type: 'photo', url: 'enc://a', polaroid: true, x: 0, y: 0, width: 200, height: 160 }],
    }, new Map([['enc://a', image()]]))

    // The card: a full-element rect, drawn after the page background.
    const card = of(ctx, 'fillRect')[1]
    expect(card.args).toEqual([0, 0, 200, 160])

    // The photo window, clipped and then translated into place.
    const window = of(ctx, 'rect')[0]
    expect(window.args).toEqual([
      POLAROID.padding,
      POLAROID.padding,
      200 - POLAROID.padding * 2,
      160 - POLAROID.padding - POLAROID.paddingBottom,
    ])
    expect(of(ctx, 'drawImage')).toHaveLength(1)
  })

  it('writes a polaroid caption under the photo', () => {
    const ctx = recordingContext()
    drawPrintPage(ctx, {
      elements: [{ id: 'p', type: 'photo', url: 'enc://a', polaroid: true, caption: 'Ostern 2026', x: 0, y: 0, width: 200, height: 160 }],
    }, new Map([['enc://a', image()]]))
    expect(of(ctx, 'fillText').map((c) => c.args[0])).toEqual(['Ostern 2026'])
  })

  it('draws a sticker as its emoji', () => {
    const ctx = recordingContext()
    drawPrintPage(ctx, {
      elements: [{ id: 's', type: 'sticker', emoji: '🎂', stickerSize: 48, x: 10, y: 10, width: 60, height: 60 }],
    })
    expect(of(ctx, 'fillText')[0].args[0]).toBe('🎂')
  })

  it('leaves an empty text box out of the page entirely', () => {
    const ctx = recordingContext()
    drawPrintPage(ctx, {
      elements: [{ id: 't', type: 'text', text: '', x: 0, y: 0, width: 100, height: 40 }],
    })
    expect(of(ctx, 'fillText')).toHaveLength(0)
  })

  it('ignores an element with no size', () => {
    const ctx = recordingContext()
    drawPrintPage(ctx, {
      elements: [{ id: 't', type: 'text', text: 'Hi', x: 0, y: 0, width: 0, height: 40 }],
    })
    expect(of(ctx, 'fillText')).toHaveLength(0)
  })

  it('balances every save with a restore, so one element cannot leak state into the next', () => {
    const ctx = recordingContext()
    drawPrintPage(ctx, {
      elements: [
        { id: 'p', type: 'photo', url: 'enc://a', polaroid: true, caption: 'x', x: 0, y: 0, width: 200, height: 160, rotation: 12 },
        { id: 't', type: 'text', text: 'Hallo', x: 0, y: 0, width: 100, height: 40 },
      ],
    }, new Map([['enc://a', image()]]))
    expect(of(ctx, 'save')).toHaveLength(of(ctx, 'restore').length)
  })
})
