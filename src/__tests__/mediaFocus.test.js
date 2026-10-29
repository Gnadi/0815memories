import { describe, it, expect } from 'vitest'
import { parseFocus, formatFocus, objectPositionAt, buildFocus } from '../utils/mediaFocus'

describe('parseFocus', () => {
  it('reads "x y" percentages', () => {
    expect(parseFocus('20 80')).toEqual({ x: 20, y: 80 })
    expect(parseFocus('12.5 0')).toEqual({ x: 12.5, y: 0 })
  })

  it('refuses anything that is not two plain numbers, since it ends up in a style', () => {
    for (const bad of ['', undefined, null, 5, '50', 'a b', '50 50; color:red', '50% 50%', '-5 20']) {
      expect(parseFocus(bad)).toBeNull()
    }
  })

  it('clamps to the photo', () => {
    expect(parseFocus('150 999')).toEqual({ x: 100, y: 100 })
  })
})

describe('formatFocus', () => {
  it('stores the centre as the default, and rounds the rest', () => {
    expect(formatFocus({ x: 50, y: 50 })).toBe('')
    expect(formatFocus({ x: 20.4, y: 79.6 })).toBe('20 80')
    expect(formatFocus({ x: -10, y: 120 })).toBe('0 100')
  })
})

describe('objectPositionAt', () => {
  const doc = { images: ['a', 'b'], focus: ['', '30 70'] }

  it('gives the CSS position of one photo', () => {
    expect(objectPositionAt(doc, 1)).toBe('30% 70%')
    expect(objectPositionAt(doc, 0)).toBeUndefined()
  })

  it('ignores a focus array that does not line up with the images', () => {
    expect(objectPositionAt({ images: ['a'], focus: ['30 70', '10 10'] }, 0)).toBeUndefined()
    expect(objectPositionAt({ images: ['a'] }, 0)).toBeUndefined()
    expect(objectPositionAt({}, 0)).toBeUndefined()
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
