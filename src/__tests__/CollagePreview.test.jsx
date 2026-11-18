/* CollagePreview draws a gallery card only once it comes near the screen. The
   gallery and the template strip drew every collage at once, off-screen ones
   included: 17 canvases and 115–320 ms of drawing on a throttled phone. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'

const drawCollage = vi.hoisted(() => vi.fn())
const loadedFor = vi.hoisted(() => [])
vi.mock('../utils/collageRenderer', () => ({ drawCollage }))
vi.mock('../hooks/useCollageImages', () => ({
  useCollageImages: (doc) => {
    loadedFor.push(doc)
    return new Map()
  },
}))

import CollagePreview from '../components/collage/CollagePreview'

const DOC = { templateId: 'grid-4', slots: [{ url: 'a.enc' }] }
let observers

beforeEach(() => {
  drawCollage.mockClear()
  loadedFor.length = 0
  observers = []
  globalThis.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback
      observers.push(this)
    }
    observe() {}
    disconnect() {}
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({})
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200)
})

afterEach(() => {
  delete globalThis.IntersectionObserver
  vi.restoreAllMocks()
})

describe('CollagePreview', () => {
  it('draws at once where it is not lazy, as the editor needs', async () => {
    render(<CollagePreview doc={DOC} />)
    await waitFor(() => expect(drawCollage).toHaveBeenCalledTimes(1))
  })

  it('loads and draws a lazy one only once it nears the screen', async () => {
    render(<CollagePreview doc={DOC} lazy />)
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(drawCollage).not.toHaveBeenCalled()
    expect(loadedFor.every((doc) => doc === null)).toBe(true)

    act(() => observers[0].callback([{ isIntersecting: true }]))
    await waitFor(() => expect(drawCollage).toHaveBeenCalledTimes(1))
    expect(loadedFor.at(-1)).toBe(DOC)
  })
})
