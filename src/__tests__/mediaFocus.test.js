import { describe, it, expect } from 'vitest'
import { parseFocus, formatFocus, focusStyleAt, buildFocus } from '../utils/mediaFocus'

describe('parseFocus', () => {
  it('reads "x y" percentages', () => {
    expect(parseFocus('20 80')).toEqual({ x: 20, y: 80, zoom: 1 })
    expect(parseFocus('12.5 0')).toEqual({ x: 12.5, y: 0, zoom: 1 })
  })

  it('refuses anything that is not two plain numbers, since it ends up in a style', () => {
    for (const bad of ['', undefined, null, 5, '50', 'a b', '50 50; color:red', '50% 50%', '-5 20', '1 2 3 4']) {
      expect(parseFocus(bad)).toBeNull()
    }
  })

  it('reads a zoom, kept between 1 and 3', () => {
    expect(parseFocus('20 80 2.5')).toEqual({ x: 20, y: 80, zoom: 2.5 })
    expect(parseFocus('20 80 9')?.zoom).toBe(3)
    expect(parseFocus('20 80 0.2')?.zoom).toBe(1)
  })

  it('clamps to the photo', () => {
    expect(parseFocus('150 999')).toEqual({ x: 100, y: 100, zoom: 1 })
  })
})

describe('formatFocus', () => {
  it('stores the centre as the default, and rounds the rest', () => {
    expect(formatFocus({ x: 50, y: 50 })).toBe('')
    expect(formatFocus({ x: 20.4, y: 79.6 })).toBe('20 80')
    expect(formatFocus({ x: -10, y: 120 })).toBe('0 100')
  })

  it('adds the zoom only when there is one; a centred photo that is zoomed is not the default', () => {
    expect(formatFocus({ x: 20, y: 80, zoom: 1 })).toBe('20 80')
    expect(formatFocus({ x: 20, y: 80, zoom: 2.04 })).toBe('20 80 2')
    expect(formatFocus({ x: 50, y: 50, zoom: 1.5 })).toBe('50 50 1.5')
  })
})

describe('focusStyleAt', () => {
  const doc = { images: ['a', 'b', 'c'], focus: ['', '30 70', '30 70 2'] }

  it('gives the style of one photo', () => {
    expect(focusStyleAt(doc, 1)).toEqual({ objectPosition: '30% 70%' })
    expect(focusStyleAt(doc, 2)).toEqual({
      objectPosition: '30% 70%',
      transform: 'scale(2)',
      transformOrigin: '30% 70%',
    })
    expect(focusStyleAt(doc, 0)).toBeUndefined()
  })

  it('ignores a focus array that does not line up with the images', () => {
    expect(focusStyleAt({ images: ['a'], focus: ['30 70', '10 10'] }, 0)).toBeUndefined()
    expect(focusStyleAt({ images: ['a'] }, 0)).toBeUndefined()
    expect(focusStyleAt({}, 0)).toBeUndefined()
  })
})

describe('buildFocus', () => {
  const images = [{ focus: '' }, { focus: '10 20' }]

  it('keeps the photos in order', () => {
    expect(buildFocus(images)).toEqual(['', '10 20'])
  })

  it('leaves the field off when every photo is centred, unless an edit must overwrite', () => {
    expect(buildFocus([{ focus: '' }, {}])).toBeNull()
    expect(buildFocus([{ focus: '' }, {}], true)).toEqual(['', ''])
  })
})
