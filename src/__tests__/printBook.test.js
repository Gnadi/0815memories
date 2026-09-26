/**
 * The arithmetic behind a printed scrapbook — utils/printBook.js.
 *
 * Every number here ends up on paper or in Peecho's checkout: a wrong frame
 * crops a page, a wrong page count gets the book a white back cover, and a
 * wrong attribute sends the customer to checkout for the wrong product.
 */
import { describe, it, expect } from 'vitest'
import {
  printConfig,
  printFrame,
  printPixelRatio,
  printSequence,
  createPrintPdf,
  DEFAULT_FORMAT,
  PAGE_WIDTH,
  PAGE_HEIGHT,
} from '../utils/printBook'

const A4_LANDSCAPE = { widthMm: 297, heightMm: 210 }

describe('printConfig', () => {
  it('is off unless turned on, and prints A4 landscape by default', () => {
    expect(printConfig({})).toEqual({ enabled: false, ...DEFAULT_FORMAT, currency: '' })
    expect(printConfig({ VITE_PEECHO_ENABLED: 'yes' }).enabled).toBe(false)
  })

  it('reads the switch, the format and the currency', () => {
    expect(printConfig({
      VITE_PEECHO_ENABLED: 'true',
      VITE_PEECHO_PAGE_WIDTH_MM: '280',
      VITE_PEECHO_PAGE_HEIGHT_MM: '210',
      VITE_PEECHO_CURRENCY: 'eur',
    })).toEqual({ enabled: true, widthMm: 280, heightMm: 210, currency: 'EUR' })
  })

  it('falls back per dimension on nonsense sizes, and drops a malformed currency', () => {
    const config = printConfig({ VITE_PEECHO_PAGE_WIDTH_MM: 'wide', VITE_PEECHO_PAGE_HEIGHT_MM: '-3', VITE_PEECHO_CURRENCY: 'euro' })
    expect(config.widthMm).toBe(297)
    expect(config.heightMm).toBe(210)
    expect(config.currency).toBe('')
  })
})

describe('printFrame', () => {
  it('widens the 4:3 page to A4 landscape and centres it, cropping nothing', () => {
    const frame = printFrame(A4_LANDSCAPE)
    expect(frame.height).toBe(PAGE_HEIGHT)
    expect(frame.width).toBe(Math.round(600 * 297 / 210)) // 849
    expect(frame.offsetY).toBe(0)
    expect(frame.offsetX).toBeCloseTo((frame.width - PAGE_WIDTH) / 2)
    expect(frame.width / frame.height).toBeCloseTo(297 / 210, 2)
  })

  it('adds height instead for a format squarer than the page', () => {
    const frame = printFrame({ widthMm: 210, heightMm: 210 })
    expect(frame).toEqual({ width: 800, height: 800, offsetX: 0, offsetY: 100 })
  })

  it('is the page itself when the format is 4:3', () => {
    expect(printFrame({ widthMm: 280, heightMm: 210 })).toEqual({ width: 800, height: 600, offsetX: 0, offsetY: 0 })
  })
})

describe('printPixelRatio', () => {
  it('puts 300 dots on every inch of paper', () => {
    const frame = printFrame(A4_LANDSCAPE)
    const ratio = printPixelRatio(frame, A4_LANDSCAPE)
    // 297 mm at 300 dpi is 3508 pixels across.
    expect(frame.width * ratio).toBeCloseTo((297 / 25.4) * 300, 0)
  })

  // iOS Safari will not draw into a larger canvas at all.
  it('settles for less than 300 dpi rather than exceed what one canvas can hold', () => {
    const a3 = { widthMm: 420, heightMm: 297 }
    const frame = printFrame(a3)
    const ratio = printPixelRatio(frame, a3)
    const area = frame.width * ratio * frame.height * ratio
    expect(area).toBeLessThanOrEqual(16_777_216)
    expect(ratio).toBeLessThan(((420 / 25.4) * 300) / frame.width)
  })
})

describe('printSequence', () => {
  const page = (backgroundColor) => ({ backgroundColor, elements: [] })

  it('adds a back cover in the front cover’s colour, and nothing else when the count is then even', () => {
    const sheets = printSequence([page('#2D1B0E'), page('#FDF6EC'), page('#FDF6EC')])
    expect(sheets).toEqual([
      { kind: 'page', index: 0 },
      { kind: 'page', index: 1 },
      { kind: 'page', index: 2 },
      { kind: 'back', color: '#2D1B0E' },
    ])
  })

  // An odd count would get the book Peecho's white stand-in for a back cover.
  it('puts a blank page before the back cover when the count would be odd', () => {
    const sheets = printSequence([page('#C25A2E'), page('#FDF6EC')])
    expect(sheets).toHaveLength(4)
    expect(sheets[2]).toEqual({ kind: 'blank', color: '#FFFFFF' })
    expect(sheets[3]).toEqual({ kind: 'back', color: '#C25A2E' })
  })

  it('always comes out even', () => {
    for (let n = 1; n <= 30; n++) {
      const sheets = printSequence(Array.from({ length: n }, () => page('#FDF6EC')))
      expect(sheets.length % 2, `${n} pages`).toBe(0)
      expect(sheets.at(-1).kind).toBe('back')
      expect(sheets.filter((s) => s.kind === 'page')).toHaveLength(n)
    }
  })

  it('falls back to the default background when the cover colour is not a plain hex colour', () => {
    expect(printSequence([page(undefined)]).at(-1).color).toBe('#FDF6EC')
    expect(printSequence([page('url(x)')]).at(-1).color).toBe('#FDF6EC')
  })
})

describe('createPrintPdf', () => {
  function fakeJsPDF() {
    const calls = []
    class JsPDF {
      constructor(options) { calls.push(['new', options]) }
      setProperties(props) { calls.push(['setProperties', props]) }
      addPage(format, orientation) { calls.push(['addPage', format, orientation]) }
      addImage(...args) { calls.push(['addImage', ...args]) }
      setFillColor(color) { calls.push(['setFillColor', color]) }
      rect(...args) { calls.push(['rect', ...args]) }
      output(type) { calls.push(['output', type]); return 'blob' }
    }
    return { JsPDF, calls }
  }

  it('lays every page out full-bleed at the print size, one page per sheet', () => {
    const { JsPDF, calls } = fakeJsPDF()
    const pdf = createPrintPdf(JsPDF, A4_LANDSCAPE, { title: 'Summer' })
    const jpeg = new Uint8Array([1, 2, 3])
    pdf.addImage(jpeg)
    pdf.addImage(jpeg)
    pdf.addPlain('#2D1B0E')

    expect(pdf.pageCount).toBe(3)
    expect(calls[0]).toEqual(['new', { orientation: 'landscape', unit: 'mm', format: [297, 210], compress: true }])
    expect(calls).toContainEqual(['setProperties', { title: 'Summer' }])
    // The first page comes with the document; two more are added.
    expect(calls.filter(([name]) => name === 'addPage')).toEqual([
      ['addPage', [297, 210], 'landscape'],
      ['addPage', [297, 210], 'landscape'],
    ])
    expect(calls.filter(([name]) => name === 'addImage')).toEqual([
      ['addImage', jpeg, 'JPEG', 0, 0, 297, 210, 'page-1', 'NONE'],
      ['addImage', jpeg, 'JPEG', 0, 0, 297, 210, 'page-2', 'NONE'],
    ])
    expect(calls).toContainEqual(['setFillColor', '#2D1B0E'])
    expect(calls).toContainEqual(['rect', 0, 0, 297, 210, 'F'])
    expect(pdf.toBlob()).toBe('blob')
  })

  it('makes a portrait document for a portrait format', () => {
    const { JsPDF, calls } = fakeJsPDF()
    createPrintPdf(JsPDF, { widthMm: 210, heightMm: 297 })
    expect(calls[0][1].orientation).toBe('portrait')
    expect(calls.some(([name]) => name === 'setProperties')).toBe(false)
  })

  it('paints a plain page white when handed something that is not a colour', () => {
    const { JsPDF, calls } = fakeJsPDF()
    createPrintPdf(JsPDF, A4_LANDSCAPE).addPlain('red; evil')
    expect(calls).toContainEqual(['setFillColor', '#FFFFFF'])
  })

  it('makes A4 landscape pages with the real jsPDF', async () => {
    const { default: jsPDF } = await import('jspdf')
    const pdf = createPrintPdf(jsPDF, A4_LANDSCAPE)
    pdf.addPlain('#FDF6EC')
    pdf.addPlain('#2D1B0E')
    const blob = pdf.toBlob()
    expect(blob).toBeInstanceOf(Blob)
    const text = await blob.text()
    const boxes = [...text.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map(([, w, h]) => [Number(w), Number(h)])
    expect(boxes).toHaveLength(2)
    for (const [width, height] of boxes) {
      // 297 × 210 mm in points, the long side across.
      expect(width).toBeCloseTo((297 / 25.4) * 72, 2)
      expect(height).toBeCloseTo((210 / 25.4) * 72, 2)
    }
  })
})
