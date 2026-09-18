import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EXPORT_PENDING_ATTR, waitForExportCanvases } from '../components/scrapbook/exportReady'

describe('waitForExportCanvases', () => {
  let root

  beforeEach(() => {
    vi.useFakeTimers()
    root = document.createElement('div')
    document.body.appendChild(root)
  })

  afterEach(() => {
    vi.useRealTimers()
    root.remove()
  })

  const addCanvas = (pending) => {
    const canvas = document.createElement('canvas')
    if (pending) canvas.setAttribute(EXPORT_PENDING_ATTR, '')
    root.appendChild(canvas)
    return canvas
  }

  it('resolves at once when nothing is waiting to be painted', async () => {
    addCanvas(false)
    await expect(waitForExportCanvases(root)).resolves.toBeUndefined()
  })

  // The bug this guards: the capture ran while a photo was still decoding, and
  // that photo was simply missing from the PDF.
  it('waits for a canvas that has not been painted yet', async () => {
    const canvas = addCanvas(true)
    let settled = false
    const waiting = waitForExportCanvases(root).then(() => { settled = true })

    await vi.advanceTimersByTimeAsync(1000)
    expect(settled).toBe(false)

    canvas.removeAttribute(EXPORT_PENDING_ATTR)
    await vi.advanceTimersByTimeAsync(100)
    await waiting
    expect(settled).toBe(true)
  })

  it('gives up after the timeout so a stuck photo cannot block the export', async () => {
    addCanvas(true)
    let settled = false
    const waiting = waitForExportCanvases(root, 500).then(() => { settled = true })

    await vi.advanceTimersByTimeAsync(400)
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(200)
    await waiting
    expect(settled).toBe(true)
  })
})
