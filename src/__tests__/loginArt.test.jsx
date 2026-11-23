import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import LoginArt from '../components/auth/LoginArt'
import { LOGIN_ART_MOTIFS, pickLoginArt } from '../components/auth/loginArtFiles'

/**
 * The standard pictures of the login page. Their files have to be on disk at
 * the size the page reserves for them, or the layout jumps when they arrive.
 */

// Width and height from a lossy WebP's VP8 frame header.
function webpSize(path) {
  const b = readFileSync(path)
  expect(b.subarray(0, 4).toString()).toBe('RIFF')
  expect(b.subarray(8, 16).toString()).toBe('WEBPVP8 ')
  return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff }
}

describe('login pictures', () => {
  it.each(LOGIN_ART_MOTIFS.map((m) => [m.id, m]))('%s is on disk at its stated sizes', (_, motif) => {
    for (const art of [motif.desktop, motif.mobile]) {
      expect(webpSize(`public${art.src}`)).toEqual({ width: art.width, height: art.height })
    }
  })

  it('picks each motif for its share of visits', () => {
    const picked = [0, 0.49, 0.5, 0.9999].map((r) => pickLoginArt(() => r).id)
    expect(new Set(picked)).toEqual(new Set(LOGIN_ART_MOTIFS.map((m) => m.id)))
  })

  it('gives desktops the portrait and phones the banner, as decoration', () => {
    const motif = LOGIN_ART_MOTIFS[1]
    const { container } = render(<LoginArt motif={motif} />)
    expect(container.querySelector('source')).toHaveAttribute('srcset', motif.desktop.src)
    expect(container.querySelector('source')).toHaveAttribute('media', '(min-width: 1024px)')
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', motif.mobile.src)
    expect(img).toHaveAttribute('alt', '')
  })

  it('gives a phone-sized preview the banner only', () => {
    const { container } = render(<LoginArt motif={LOGIN_ART_MOTIFS[0]} phoneOnly />)
    expect(container.querySelector('source')).toBeNull()
  })
})
