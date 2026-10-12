/**
 * The landing page's screenshots (src/components/landing/screenshots.js).
 *
 * Every picture the page shows has to exist in every language, at the size the
 * page gives its <img>: a missing one is a broken image on the front page, and
 * a wrong size makes the page jump as it loads. Pictures are taken again with
 * scripts/capture-screenshots.mjs, and this is what notices one left behind.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import {
  SCREENSHOTS,
  SCREENSHOT_LANGUAGES,
  screenshotPath,
  screenshotSize,
} from '../components/landing/screenshots'
import { demoTarget } from '../demo/demoMode'

const ROOT = globalThis.process.cwd()

describe('landing page screenshots', () => {
  for (const lang of SCREENSHOT_LANGUAGES) {
    for (const [key, shot] of Object.entries(SCREENSHOTS)) {
      it(`${key} exists in ${lang} at the declared size`, async () => {
        const file = join(ROOT, 'public', screenshotPath(shot, lang))
        expect(existsSync(file), file).toBe(true)
        const { width, height } = await sharp(file).metadata()
        expect({ width, height }).toEqual(screenshotSize(shot, lang))
      })
    }
  }

  it('names only screenshots that are listed', () => {
    const page = readFileSync(join(ROOT, 'src', 'pages', 'LandingPage.jsx'), 'utf8')
    expect(page).not.toMatch(/["'`]\/screenshots\//)
    // shot('key') in the page, and the keys of the list the structured data
    // maps through shot(key).
    const direct = [...page.matchAll(/shot\('(\w+)'\)/g)].map((m) => m[1])
    const listed = page.match(/screenshot: \[([^\]]*)\]\s*\.map\(\(key\) =>/)[1].match(/\w+/g)
    const used = [...direct, ...listed]
    expect(used.length).toBeGreaterThan(0)
    for (const key of used) expect(Object.keys(SCREENSHOTS)).toContain(key)
  })

  it('puts English pictures at the top and the rest in a folder per language', () => {
    expect(screenshotPath(SCREENSHOTS.bestOf, 'en')).toBe('/screenshots/best-of-mobile.webp')
    expect(screenshotPath(SCREENSHOTS.bestOf, 'de')).toBe('/screenshots/de/best-of-mobile.webp')
    expect(screenshotPath(SCREENSHOTS.bestOf, 'fr')).toBe('/screenshots/best-of-mobile.webp')
  })
})

describe('demoTarget', () => {
  it('opens the demo on a listed part of the app', () => {
    expect(demoTarget('?to=/scrapbook')).toBe('/scrapbook')
    expect(demoTarget('?to=/journal')).toBe('/journal')
  })

  it('falls back to the feed for anything else', () => {
    expect(demoTarget('')).toBe('/home')
    expect(demoTarget('?to=//evil.example')).toBe('/home')
    expect(demoTarget('?to=https://evil.example/')).toBe('/home')
    expect(demoTarget('?to=/settings')).toBe('/home')
  })
})
