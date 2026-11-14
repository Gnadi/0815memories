/**
 * The scrapbook page laid out for print — ScrapbookCanvas's `printFrame`.
 *
 * On paper the page takes the print format's shape: the background runs to
 * every edge, the editor's dark border is gone, and the elements keep their
 * places inside the page's own 800 × 600, centred.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { createRef } from 'react'
import { render } from '@testing-library/react'

vi.mock('../components/media/EncryptedImage', () => ({ default: () => null }))
vi.mock('../components/media/useDecryptedMedia', () => ({ default: () => ({ decryptedUrl: null }) }))

const ScrapbookCanvas = (await import('../components/scrapbook/ScrapbookCanvas')).default

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  }
  // jsdom has no 2D context; the export canvases only need one to draw into.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => new Proxy({}, {
    get: (target, name) => (name in target ? target[name] : name === 'measureText' ? () => ({ width: 10 }) : () => {}),
    set: (target, name, value) => { target[name] = value; return true },
  }))
})

const page = {
  id: 'p1',
  backgroundColor: '#C25A2E',
  backgroundPattern: 'dots',
  customizable: true,
  elements: [{ id: 't1', type: 'text', text: 'Summer', x: 40, y: 30, width: 200, height: 60, zIndex: 1 }],
}

function mount(props) {
  const ref = createRef()
  render(<ScrapbookCanvas ref={ref} page={page} onSelectElement={() => {}} onUpdateElement={() => {}} {...props} />)
  const canvas = ref.current
  return { canvas, pageBox: canvas.firstElementChild }
}

describe('ScrapbookCanvas print frame', () => {
  it('in the editor: 800 × 600 with its border, the elements filling it', () => {
    const { canvas, pageBox } = mount({})
    expect(canvas.style.width).toBe('800px')
    expect(canvas.style.height).toBe('600px')
    expect(canvas.style.border).toBe('2px solid var(--color-bark)')
    expect(pageBox.style.inset).toBe('0px')
    expect(pageBox.style.overflow).toBe('hidden')
    expect(pageBox.textContent).toContain('Summer')
  })

  it('for print: the frame’s shape, no border, the page centred in it', () => {
    const printFrame = { width: 849, height: 600, offsetX: 24.5, offsetY: 0 }
    const { canvas, pageBox } = mount({ printFrame, exporting: true, exportRatio: 4 })
    expect(canvas.style.width).toBe('849px')
    expect(canvas.style.height).toBe('600px')
    expect(canvas.style.borderStyle).toBe('none')
    // The background — colour and pattern — runs to every edge of the paper,
    // with the pattern lined up on the page as in the editor.
    expect(canvas.style.background).toContain('rgb(194, 90, 46)')
    expect(canvas.style.backgroundPosition).toBe('24.5px 0px')
    expect(pageBox.style.left).toBe('24.5px')
    expect(pageBox.style.top).toBe('0px')
    expect(pageBox.style.width).toBe('800px')
    expect(pageBox.style.height).toBe('600px')
    expect(pageBox.style.overflow).toBe('hidden')
  })

  // At the PDF download's ratio of 2, a print capture at ~4 would upscale
  // every photo and every line of text twofold.
  it('draws the export canvases at the print capture’s ratio', () => {
    const printFrame = { width: 849, height: 600, offsetX: 24.5, offsetY: 0 }
    const { pageBox } = mount({ printFrame, exporting: true, exportRatio: 4 })
    const textCanvas = pageBox.querySelector('canvas')
    const cssWidth = parseFloat(textCanvas.style.width)
    expect(textCanvas.width).toBe(Math.round(cssWidth * 4))
  })
})
