import { describe, it, expect } from 'vitest'
import {
  LOGIN_THEME_PRESETS,
  THEME_FONTS,
  themeToStyles,
  themeDecorationEmojis,
  themeText,
} from '../utils/loginTheme'

describe('themeToStyles', () => {
  it.each(Object.keys(LOGIN_THEME_PRESETS))('renders the %s preset', (key) => {
    const { pageStyle, headingStyle } = themeToStyles(LOGIN_THEME_PRESETS[key])
    expect(pageStyle.background).toContain('linear-gradient')
    expect(headingStyle.color).toMatch(/^#/)
  })

  it('renders a solid color background', () => {
    const { pageStyle } = themeToStyles({ background: { type: 'color', color: '#123456' } })
    expect(pageStyle.background).toBe('#123456')
  })

  it('renders an https image background', () => {
    const { pageStyle } = themeToStyles({
      background: { type: 'image', imageUrl: 'https://res.cloudinary.com/x/bg.jpg' },
    })
    expect(pageStyle.backgroundImage).toContain('res.cloudinary.com')
    expect(pageStyle.backgroundSize).toBe('cover')
  })

  it('rejects non-https and malformed image URLs', () => {
    expect(
      themeToStyles({ background: { type: 'image', imageUrl: 'javascript:alert(1)' } }).pageStyle
        .backgroundImage
    ).toBeUndefined()
    expect(
      themeToStyles({ background: { type: 'image', imageUrl: 'not a url' } }).pageStyle
        .backgroundImage
    ).toBeUndefined()
  })

  it('rejects invalid colors and falls back', () => {
    const { pageStyle, headingStyle } = themeToStyles({
      background: { type: 'color', color: 'red; } body { display:none' },
      textColor: 'url(evil)',
    })
    expect(pageStyle.background).toBe('#fdf8f0')
    expect(headingStyle.color).toBeUndefined()
  })

  it('clamps gradient angle and falls back on junk', () => {
    const good = themeToStyles({
      background: { type: 'gradient', from: '#000000', to: '#ffffff', angle: 720 },
    })
    expect(good.pageStyle.background).toContain('360deg')
    const junk = themeToStyles({
      background: { type: 'gradient', from: '#000000', to: '#ffffff', angle: 'calc(evil)' },
    })
    expect(junk.pageStyle.background).toContain('160deg')
  })

  it('only uses curated font stacks', () => {
    expect(themeToStyles({ font: 'playful' }).pageStyle.fontFamily).toBe(THEME_FONTS.playful)
    expect(themeToStyles({ font: 'monospace; } * { display:none' }).pageStyle.fontFamily).toBeUndefined()
  })

  it('survives malformed input', () => {
    for (const input of [null, undefined, 42, 'nope', [], { background: 'nope' }]) {
      const { pageStyle } = themeToStyles(input)
      expect(typeof pageStyle).toBe('object')
    }
  })
})

describe('themeDecorationEmojis', () => {
  it('returns emojis for known keys and empty otherwise', () => {
    expect(themeDecorationEmojis({ decorations: 'stars' }).length).toBeGreaterThan(0)
    expect(themeDecorationEmojis({ decorations: 'nope' })).toEqual([])
    expect(themeDecorationEmojis(null)).toEqual([])
  })
})

describe('themeText', () => {
  it('returns trimmed strings capped at 200 chars', () => {
    expect(themeText({ welcomeTitle: '  Hello  ' }, 'welcomeTitle')).toBe('Hello')
    expect(themeText({ welcomeTitle: 'a'.repeat(500) }, 'welcomeTitle').length).toBe(200)
    expect(themeText({ welcomeTitle: 42 }, 'welcomeTitle')).toBe('')
    expect(themeText(null, 'welcomeTitle')).toBe('')
  })
})
