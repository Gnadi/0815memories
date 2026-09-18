import { describe, it, expect } from 'vitest'
import { wrapLines, layoutTextBlock } from '../utils/canvasText'

// A stand-in for a monospaced face: every character is 10px wide.
const measure = (text) => text.length * 10

describe('wrapLines', () => {
  it('keeps a line that fits', () => {
    expect(wrapLines('hello', 100, measure)).toEqual(['hello'])
  })

  it('wraps at spaces', () => {
    expect(wrapLines('one two three', 60, measure)).toEqual(['one', 'two', 'three'])
  })

  it('honours explicit line breaks', () => {
    expect(wrapLines('a\nb', 100, measure)).toEqual(['a', 'b'])
  })

  // The editor sets `word-break: break-word`, so the export has to break a long
  // word too or it would run off the page.
  it('breaks a word wider than the box', () => {
    expect(wrapLines('abcdefgh', 30, measure)).toEqual(['abc', 'def', 'gh'])
  })
})

describe('layoutTextBlock', () => {
  const base = { width: 200, height: 100, fontSize: 20, ascent: 16, descent: 4, measure }

  // The bug this replaces: the PDF drew every line lower than the editor did.
  // One line sits with its glyphs centred on the box, whatever the line height.
  it('centres one line on the box regardless of line height', () => {
    const tight = layoutTextBlock({ ...base, lines: ['hi'], lineHeight: 1 })
    const loose = layoutTextBlock({ ...base, lines: ['hi'], lineHeight: 2 })
    expect(tight[0].baseline).toBeCloseTo(56)
    expect(loose[0].baseline).toBeCloseTo(56)
  })

  it('stacks lines a line height apart, centred as a block', () => {
    const [first, second] = layoutTextBlock({ ...base, lines: ['a', 'b'], lineHeight: 1.5 })
    expect(second.baseline - first.baseline).toBeCloseTo(30)
    expect((first.baseline + second.baseline) / 2).toBeCloseTo(56)
  })

  it('places lines horizontally by alignment', () => {
    const opts = { ...base, lines: ['abcde'], lineHeight: 1.25 }
    expect(layoutTextBlock({ ...opts, textAlign: 'left' })[0].x).toBe(0)
    expect(layoutTextBlock({ ...opts, textAlign: 'center' })[0].x).toBe(75)
    expect(layoutTextBlock({ ...opts, textAlign: 'right' })[0].x).toBe(150)
  })

  it('follows the font\'s own ascent and descent', () => {
    const opts = { ...base, lines: ['hi'], lineHeight: 1.25 }
    expect(layoutTextBlock({ ...opts, ascent: 10, descent: 10 })[0].baseline).toBeCloseTo(50)
    expect(layoutTextBlock({ ...opts, ascent: 18, descent: 2 })[0].baseline).toBeCloseTo(58)
  })

  it('falls back to em-based metrics when the browser reports no font box', () => {
    const [line] = layoutTextBlock({ ...base, ascent: undefined, descent: undefined, lines: ['hi'], lineHeight: 1.25 })
    expect(line.baseline).toBeCloseTo(56)
  })
})
