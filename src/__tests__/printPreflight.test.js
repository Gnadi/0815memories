import { describe, it, expect } from 'vitest'
import {
  ISSUE,
  LEVEL,
  assemblePrintPages,
  checkPage,
  pageCountPlan,
  photoDpi,
  photoImageBox,
  rotatedBounds,
  runPreflight,
} from '../utils/printPreflight'
import { getFormat, getProduct, formatPixelSize, DEFAULT_FORMAT_ID } from '../utils/printFormats'
import { DESIGN_WIDTH } from '../utils/scrapbookStyles'

const format = getFormat(DEFAULT_FORMAT_ID)
const hardcover = getProduct('hardcover')

const image = (w, h) => ({ naturalWidth: w, naturalHeight: h })

// A photo that fills the whole page needs this many pixels to print at 300 dpi.
const FULL_PAGE_PX = formatPixelSize(format).width

function photo(overrides = {}) {
  return { id: 'p1', type: 'photo', url: 'enc://a', x: 0, y: 0, width: 400, height: 300, ...overrides }
}

describe('rotatedBounds', () => {
  it('returns the box itself when nothing is rotated', () => {
    expect(rotatedBounds({ x: 10, y: 20, width: 100, height: 50 }))
      .toEqual({ left: 10, top: 20, right: 110, bottom: 70 })
  })

  it('swaps the extents at a quarter turn', () => {
    const b = rotatedBounds({ x: 0, y: 0, width: 100, height: 50, rotation: 90 })
    expect(b.right - b.left).toBeCloseTo(50, 5)
    expect(b.bottom - b.top).toBeCloseTo(100, 5)
  })

  it('reports the overhang a tilted element gains', () => {
    // The case the safe-area check exists for: a title rotated for effect
    // reaches further out than its own box.
    const straight = rotatedBounds({ x: 0, y: 0, width: 200, height: 40 })
    const tilted = rotatedBounds({ x: 0, y: 0, width: 200, height: 40, rotation: 8 })
    expect(tilted.left).toBeLessThan(straight.left)
    expect(tilted.right).toBeGreaterThan(straight.right)
  })
})

describe('photoImageBox', () => {
  it('is the whole element for a bare photo', () => {
    expect(photoImageBox(photo())).toEqual({ width: 400, height: 300 })
  })

  it('is the inner window for a polaroid', () => {
    const box = photoImageBox(photo({ polaroid: true }))
    expect(box.width).toBe(400 - 16)
    expect(box.height).toBe(300 - 32)
  })
})

describe('photoDpi', () => {
  it('reports 300 dpi for a photo that brings the pixels the page needs', () => {
    const el = photo({ width: DESIGN_WIDTH, height: 600 })
    expect(photoDpi(el, image(FULL_PAGE_PX, Math.round(FULL_PAGE_PX * 0.75)), format)).toBeCloseTo(300, 0)
  })

  it('falls with the zoom, because zooming samples less of the original', () => {
    const el = photo({ width: DESIGN_WIDTH, height: 600 })
    const img = image(FULL_PAGE_PX, Math.round(FULL_PAGE_PX * 0.75))
    const zoomed = photoDpi({ ...el, imageScale: 2 }, img, format)
    expect(zoomed).toBeCloseTo(150, 0)
  })

  it('is null when the photo never loaded', () => {
    expect(photoDpi(photo(), null, format)).toBeNull()
  })
})

describe('checkPage', () => {
  const images = new Map([['enc://a', image(FULL_PAGE_PX, FULL_PAGE_PX)]])

  it('passes a page whose photo is sharp and well inside the trim', () => {
    const page = { elements: [photo({ x: 100, y: 100, width: 300, height: 300 })] }
    expect(checkPage(page, images, format, 0)).toEqual([])
  })

  it('flags a photo that would print visibly soft', () => {
    const page = { elements: [photo({ x: 100, y: 100, width: 600, height: 400 })] }
    const issues = checkPage(page, new Map([['enc://a', image(400, 300)]]), format, 0)
    expect(issues[0].code).toBe(ISSUE.VERY_LOW_RESOLUTION)
    expect(issues[0].level).toBe(LEVEL.ERROR)
    expect(issues[0].dpi).toBeGreaterThan(0)
  })

  it('warns about a photo that is merely a bit soft', () => {
    const page = { elements: [photo({ x: 100, y: 100, width: 400, height: 300 })] }
    // ~140 dpi across a 400-design-px box.
    const issues = checkPage(page, new Map([['enc://a', image(770, 578)]]), format, 0)
    expect(issues[0].code).toBe(ISSUE.LOW_RESOLUTION)
    expect(issues[0].level).toBe(LEVEL.WARNING)
  })

  it('names an empty slot rather than silently dropping it', () => {
    const page = { elements: [photo({ url: null })] }
    expect(checkPage(page, images, format, 3)[0]).toMatchObject({ code: ISSUE.EMPTY_SLOT, pageIndex: 3 })
  })

  it('treats a photo that would not load as blocking', () => {
    const page = { elements: [photo({ url: 'enc://missing' })] }
    expect(checkPage(page, images, format, 0)[0]).toMatchObject({ code: ISSUE.MISSING_PHOTO, level: LEVEL.ERROR })
  })

  it('warns when text sits in the trim zone', () => {
    const page = { elements: [{ id: 't', type: 'text', text: 'Hallo', x: 2, y: 2, width: 200, height: 40 }] }
    expect(checkPage(page, images, format, 0)[0]).toMatchObject({ code: ISSUE.OUTSIDE_SAFE_AREA })
  })

  it('leaves a photo bleeding off the edge alone — that is a design choice', () => {
    const page = { elements: [photo({ x: -20, y: -20, width: 400, height: 300 })] }
    const codes = checkPage(page, images, format, 0).map((i) => i.code)
    expect(codes).not.toContain(ISSUE.OUTSIDE_SAFE_AREA)
  })

  it('does protect a polaroid caption, which is text', () => {
    const page = { elements: [photo({ x: -20, y: -20, polaroid: true, caption: 'Ostern' })] }
    const codes = checkPage(page, images, format, 0).map((i) => i.code)
    expect(codes).toContain(ISSUE.OUTSIDE_SAFE_AREA)
  })

  it('ignores an empty text box', () => {
    const page = { elements: [{ id: 't', type: 'text', text: '   ', x: 0, y: 0, width: 100, height: 20 }] }
    expect(checkPage(page, images, format, 0)).toEqual([])
  })
})

describe('pageCountPlan', () => {
  it('lifts a short book to the binding minimum', () => {
    expect(pageCountPlan(6, hardcover)).toMatchObject({ target: 24, pagesToAdd: 18 })
  })

  it('rounds an odd count up to a whole sheet', () => {
    expect(pageCountPlan(25, hardcover)).toMatchObject({ target: 26, pagesToAdd: 1 })
  })

  it('leaves a book that already fits alone', () => {
    expect(pageCountPlan(24, hardcover)).toMatchObject({ target: 24, pagesToAdd: 0 })
  })

  it('reports a book that is too long to bind', () => {
    expect(pageCountPlan(400, hardcover).exceedsMaximum).toBe(true)
  })
})

describe('assemblePrintPages', () => {
  it('appends blank pages that carry the book’s own background', () => {
    const pages = [{ id: 'a', backgroundColor: '#112233', backgroundPattern: 'dots', elements: [] }]
    const { pages: out, added } = assemblePrintPages(pages, hardcover)
    expect(added).toBe(23)
    expect(out).toHaveLength(24)
    expect(out[23]).toMatchObject({ backgroundColor: '#112233', backgroundPattern: 'dots', elements: [] })
  })

  it('returns the book untouched when nothing has to be added', () => {
    const pages = Array.from({ length: 24 }, (_, i) => ({ id: `p${i}`, elements: [] }))
    const { pages: out, added } = assemblePrintPages(pages, hardcover)
    expect(added).toBe(0)
    expect(out).toHaveLength(24)
  })
})

describe('runPreflight', () => {
  const images = new Map([['enc://a', image(FULL_PAGE_PX, FULL_PAGE_PX)]])
  const goodPage = { id: 'p', elements: [photo({ x: 100, y: 100, width: 300, height: 300 })] }

  it('stays ok when the only outstanding thing is the page count', () => {
    // Needing blank pages is a question for the user, not a fault in the book —
    // if this flipped `ok`, the dialog would block on something it is asking about.
    const result = runPreflight([goodPage], images, {})
    expect(result.ok).toBe(true)
    expect(result.plan.pagesToAdd).toBeGreaterThan(0)
    expect(result.decisions[0].code).toBe(ISSUE.TOO_FEW_PAGES)
  })

  it('blocks on a photo that cannot be printed', () => {
    const page = { id: 'p', elements: [photo({ width: 700, height: 500 })] }
    const result = runPreflight([page], new Map([['enc://a', image(200, 150)]]), {})
    expect(result.ok).toBe(false)
    expect(result.errors[0].code).toBe(ISSUE.VERY_LOW_RESOLUTION)
  })

  it('blocks a book that is longer than the press will bind', () => {
    const pages = Array.from({ length: 400 }, () => goodPage)
    const result = runPreflight(pages, images, {})
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === ISSUE.TOO_MANY_PAGES)).toBe(true)
  })

  it('reports issues against the format actually chosen', () => {
    // The same photo is sharper on a smaller book: 20 × 15 asks for fewer
    // pixels than 28 × 21 across the same fraction of the page.
    const page = { id: 'p', elements: [photo({ x: 100, y: 100, width: 400, height: 300 })] }
    const smallImages = new Map([['enc://a', image(900, 675)]])
    const big = runPreflight([page], smallImages, { formatId: 'landscape-28x21' })
    const small = runPreflight([page], smallImages, { formatId: 'landscape-20x15' })
    expect(big.warnings.length).toBeGreaterThan(small.warnings.length)
  })
})
