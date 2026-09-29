/**
 * Walking the book page by page — components/scrapbook/pageCapture.js.
 *
 * The print file must not go out with a photo missing: a page whose photo
 * never arrived stops the capture instead of being photographed without it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { capturePages, MissingPhotosError } from '../components/scrapbook/pageCapture'
import { EXPORT_PENDING_ATTR, EXPORT_FAILED_ATTR } from '../components/scrapbook/exportReady'

describe('capturePages', () => {
  let root

  beforeEach(() => {
    root = document.createElement('div')
    document.body.appendChild(root)
    vi.stubGlobal('requestAnimationFrame', (fn) => setTimeout(fn, 0))
  })

  afterEach(() => {
    root.remove()
    vi.unstubAllGlobals()
  })

  const canvas = (attr) => {
    const c = document.createElement('canvas')
    if (attr) c.setAttribute(attr, '')
    root.appendChild(c)
    return c
  }

  const run = (options) => {
    const html2canvas = vi.fn(async () => document.createElement('canvas'))
    const onPage = vi.fn()
    const result = capturePages({
      count: 2,
      getElement: () => root,
      switchPage: vi.fn(),
      html2canvas,
      width: 800,
      height: 600,
      scale: 1,
      onPage,
      waitMs: 50,
      ...options,
    })
    return { result, html2canvas, onPage }
  }

  it('captures every page when all photos are painted', async () => {
    canvas(null)
    const { result, onPage } = run({ requireAllPhotos: true })
    await expect(result).resolves.toBe(true)
    expect(onPage).toHaveBeenCalledTimes(2)
  })

  it('refuses to capture a page whose photo never arrived', async () => {
    canvas(EXPORT_PENDING_ATTR)
    const { result, html2canvas } = run({ requireAllPhotos: true })
    const error = await result.catch((e) => e)
    expect(error).toBeInstanceOf(MissingPhotosError)
    expect(error).toMatchObject({ code: 'missing-photos', page: 1, count: 1 })
    expect(html2canvas).not.toHaveBeenCalled()
  })

  it('refuses a page whose photo failed to load', async () => {
    canvas(EXPORT_FAILED_ATTR)
    const { result } = run({ requireAllPhotos: true })
    await expect(result).rejects.toBeInstanceOf(MissingPhotosError)
  })

  // The PDF download keeps its old leniency: a stuck photo must not block it.
  it('still captures without the photo when not asked to insist', async () => {
    canvas(EXPORT_PENDING_ATTR)
    const { result, onPage } = run({})
    await expect(result).resolves.toBe(true)
    expect(onPage).toHaveBeenCalledTimes(2)
  })
})
