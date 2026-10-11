/* The best-of's collages (components/bestof/BestOfCollage.jsx) and its photo
   slides' camera moves (BestOfSlides.jsx).

   The motion itself is CSS, which jsdom does not run; what is tested is the
   markup it hangs on — how many tiles a layout gets, which class a photo
   moves by — and that a slide says it is ready only once its first photo is
   in. The media components are stand-ins; the decryption is theirs to test. */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

vi.mock('../components/media/useDecryptedMedia', () => ({
  default: (url) => ({ decryptedUrl: url ? `blob:${url}` : null, loading: false, error: null }),
}))
// The stage, reduced to what the slides hand it.
vi.mock('../components/media/CrossfadeImage', () => ({
  default: ({ src, onSettled }) => (
    <img data-kind="stage" data-src={src} alt="" onLoad={() => onSettled?.(src)} />
  ),
}))

import { CollageSlide } from '../components/bestof/BestOfCollage'
import { PhotoSlide } from '../components/bestof/BestOfSlides'

const media = (url) => ({ url, thumbUrl: `${url}-t` })
const photos = (n) => Array.from({ length: n }, (_, i) => media(`p${i}`))
const labels = { meta: (s) => [s.day, s.location].filter(Boolean).join(' · ') }

const collage = (layout, n, extra) => ({
  kind: 'collage',
  layout,
  media: photos(n),
  caption: 'Sunday at the lake',
  location: 'Zell am See',
  day: '2026-09-14',
  ...extra,
})

const tiles = () => screen.queryAllByTestId('bestof-tile')
const layoutShown = () => document.querySelector('[data-layout]')?.dataset.layout

afterEach(cleanup)

describe('CollageSlide', () => {
  it.each([
    ['duo', 2, 2],
    ['trio', 3, 3],
    ['grid', 4, 4],
    ['polaroids', 3, 3],
    ['polaroids', 4, 4],
    ['strip', 3, 3],
    ['strip', 4, 4],
  ])('lays out a %s of %i photos in %i tiles', (layout, n, expected) => {
    render(<CollageSlide slide={collage(layout, n)} labels={labels} onReady={() => {}} />)
    expect(layoutShown()).toBe(layout)
    expect(tiles()).toHaveLength(expected)
    // Each tile shows its own photo, as the thumbnail.
    const shown = tiles().map((tile) => tile.querySelector('img').getAttribute('src'))
    expect(shown).toEqual(photos(expected).map(({ url }) => `blob:${url}-t`))
  })

  it.each([
    ['duo', 2],
    ['trio', 3],
    ['grid', 4],
    ['polaroids', 4],
    ['strip', 4],
  ])('leaves out photos beyond what a %s holds', (layout, max) => {
    render(<CollageSlide slide={collage(layout, 6)} labels={labels} onReady={() => {}} />)
    expect(layoutShown()).toBe(layout)
    expect(tiles()).toHaveLength(max)
  })

  it.each(['duo', 'trio', 'grid', 'polaroids', 'strip'])(
    'says a %s is ready once its first tile’s photo is in, and only once',
    (layout) => {
      const onReady = vi.fn()
      render(<CollageSlide slide={collage(layout, 4)} labels={labels} onReady={onReady} />)
      expect(onReady).not.toHaveBeenCalled()

      // The other photos, and the polaroids' blurred backdrop, do not count.
      for (const img of document.querySelectorAll('img')) {
        if (!tiles()[0].contains(img)) fireEvent.load(img)
      }
      expect(onReady).not.toHaveBeenCalled()

      fireEvent.load(tiles()[0].querySelector('img'))
      expect(onReady).toHaveBeenCalledTimes(1)
      fireEvent.load(tiles()[0].querySelector('img'))
      expect(onReady).toHaveBeenCalledTimes(1)
    },
  )

  it('makes a trio of a grid with three photos', () => {
    const onReady = vi.fn()
    render(<CollageSlide slide={collage('grid', 3)} labels={labels} onReady={onReady} />)
    expect(layoutShown()).toBe('trio')
    expect(tiles()).toHaveLength(3)
    fireEvent.load(tiles()[0].querySelector('img'))
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it('makes a duo of a strip or polaroids with two photos, and picks for a layout it does not know', () => {
    render(<CollageSlide slide={collage('strip', 2)} labels={labels} onReady={() => {}} />)
    expect(layoutShown()).toBe('duo')
    cleanup()
    render(<CollageSlide slide={collage('polaroids', 2)} labels={labels} onReady={() => {}} />)
    expect(layoutShown()).toBe('duo')
    cleanup()
    render(<CollageSlide slide={collage('someday-a-new-layout', 5)} labels={labels} onReady={() => {}} />)
    expect(layoutShown()).toBe('grid')
    expect(tiles()).toHaveLength(4)
  })

  it('shows a single photo as a photo slide, pushing in', () => {
    const onReady = vi.fn()
    render(<CollageSlide slide={collage('duo', 1)} labels={labels} onReady={onReady} />)
    expect(tiles()).toHaveLength(0)
    expect(document.querySelector('.bestof-motion-zoomIn')).not.toBeNull()
    const stage = document.querySelector('[data-kind="stage"]')
    expect(stage.dataset.src).toBe('p0')
    expect(screen.getByText('Sunday at the lake')).toBeInTheDocument()

    expect(onReady).not.toHaveBeenCalled()
    fireEvent.load(stage)
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it('is ready at once with no photos at all, and still shows its caption', () => {
    const onReady = vi.fn()
    render(<CollageSlide slide={collage('grid', 0)} labels={labels} onReady={onReady} />)
    expect(layoutShown()).toBe('empty')
    expect(tiles()).toHaveLength(0)
    expect(onReady).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Sunday at the lake')).toBeInTheDocument()
  })

  it('does not trip over missing photos or a missing list', () => {
    const onReady = vi.fn()
    render(<CollageSlide slide={collage('trio', 0, { media: [null, media('a'), undefined, media('b')] })} labels={labels} onReady={onReady} />)
    expect(layoutShown()).toBe('duo')
    expect(tiles()).toHaveLength(2)
    cleanup()

    render(<CollageSlide slide={{ kind: 'collage', layout: 'duo' }} labels={labels} onReady={onReady} />)
    expect(layoutShown()).toBe('empty')
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it('captions the collage with its line and its day and place', () => {
    render(<CollageSlide slide={collage('polaroids', 3)} labels={labels} onReady={() => {}} />)
    expect(screen.getByText('Sunday at the lake')).toBeInTheDocument()
    expect(screen.getByText('2026-09-14 · Zell am See')).toBeInTheDocument()
  })

  it('runs the film strip far enough to bring its last photo to the middle', () => {
    render(<CollageSlide slide={collage('strip', 4)} labels={labels} onReady={() => {}} />)
    const strip = document.querySelector('.bestof-strip')
    expect(strip.style.getPropertyValue('--bestof-travel')).toBe('222%')
    const lefts = tiles().map((tile) => tile.style.left)
    expect(lefts).toEqual(['15%', '89%', '163%', '237%'])
  })

  it('lays the polaroids at their angles, one after another', () => {
    render(<CollageSlide slide={collage('polaroids', 4)} labels={labels} onReady={() => {}} />)
    const cards = tiles()
    expect(cards.map((card) => card.style.getPropertyValue('--bestof-tilt'))).toEqual(['-8deg', '6deg', '-3deg', '9deg'])
    expect(cards.map((card) => card.style.animationDelay)).toEqual(['0s', '0.3s', '0.6s', '0.9s'])
  })
})

describe('PhotoSlide', () => {
  const photo = (motion) => ({ kind: 'photo', media: media('c'), caption: 'At the lake', day: '2026-09-06', motion })

  it.each(['zoomIn', 'zoomOut', 'panLeft', 'panRight', 'panUp'])('moves the photo by %s', (motion) => {
    render(<PhotoSlide slide={photo(motion)} labels={labels} onReady={() => {}} />)
    const stage = document.querySelector('[data-kind="stage"]')
    expect(stage.parentElement.className).toContain(`bestof-motion-${motion}`)
    expect(screen.getByText('At the lake')).toBeInTheDocument()
  })

  it.each([['an unknown', 'spin'], ['no', undefined]])('pushes in for %s motion', (_, motion) => {
    render(<PhotoSlide slide={photo(motion)} labels={labels} onReady={() => {}} />)
    const stage = document.querySelector('[data-kind="stage"]')
    expect(stage.parentElement.className).toContain('bestof-motion-zoomIn')
    expect(document.querySelector('[class*="bestof-motion-spin"]')).toBeNull()
  })
})
