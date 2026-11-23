import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import LoginArt from '../components/auth/LoginArt'
import { LOGIN_ART } from '../components/auth/loginArtFiles'

/**
 * The standard picture of the login page. Its files have to be on disk at the
 * size the page reserves for them, or the layout jumps when they arrive.
 */

// Width and height from a lossy WebP's VP8 frame header.
function webpSize(path) {
  const b = readFileSync(path)
  expect(b.subarray(0, 4).toString()).toBe('RIFF')
  expect(b.subarray(8, 16).toString()).toBe('WEBPVP8 ')
  return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff }
}

describe('login picture', () => {
  it.each(Object.entries(LOGIN_ART))('%s is on disk at its stated size', (_, art) => {
    expect(webpSize(`public${art.src}`)).toEqual({ width: art.width, height: art.height })
  })

  it('gives desktops the portrait and phones the banner, as decoration', () => {
    const { container } = render(<LoginArt />)
    expect(container.querySelector('source')).toHaveAttribute('srcset', LOGIN_ART.desktop.src)
    expect(container.querySelector('source')).toHaveAttribute('media', '(min-width: 1024px)')
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', LOGIN_ART.mobile.src)
    expect(img).toHaveAttribute('alt', '')
  })

  it('gives a phone-sized preview the banner only', () => {
    const { container } = render(<LoginArt phoneOnly />)
    expect(container.querySelector('source')).toBeNull()
  })
})
