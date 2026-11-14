/**
 * Capture the app screenshots on the landing page, in every language, from
 * the demo family that lives in the browser (`/demo`). Which pictures there
 * are, and at what size, is listed in src/components/landing/screenshots.js.
 *
 * Prerequisites:
 *   VITE_PEECHO_ENABLED=true npm run dev      (serves on http://localhost:5173)
 * Then: node scripts/capture-screenshots.mjs
 *
 * No emulators and no Firebase: the demo needs neither, it has a best-of of
 * last month every time it starts, and its photos are illustrations rather
 * than the emulator seed's colour fields. Printing has to be switched on for
 * the Print button to exist at all. Uses the pre-installed Chromium
 * (CHROMIUM_PATH, or /opt/pw-browsers/chromium).
 *
 * Output: optimized .webp files in public/screenshots/ for English and
 * public/screenshots/<lang>/ for the rest (committed, shipped).
 */
import { chromium } from 'playwright'
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SCREENSHOTS, SCREENSHOT_LANGUAGES, screenshotPath, smallScreenshotPath } from '../src/components/landing/screenshots.js'

const BASE = process.env.CAPTURE_BASE_URL || 'http://localhost:5173'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = join(__dirname, '..', 'public')

async function save(png, shot, lang) {
  const dest = join(PUBLIC_DIR, screenshotPath(shot, lang))
  await mkdir(dirname(dest), { recursive: true })
  const info = await sharp(png).resize({ width: shot.out, withoutEnlargement: true }).webp({ quality: 82 }).toFile(dest)
  console.log(`  ✔ ${screenshotPath(shot, lang)}  ${info.width}×${info.height}`)
  if (shot.small) {
    const smallDest = join(PUBLIC_DIR, smallScreenshotPath(shot, lang))
    const small = await sharp(png).resize({ width: shot.small }).webp({ quality: 82 }).toFile(smallDest)
    console.log(`  ✔ ${smallScreenshotPath(shot, lang)}  ${small.width}×${small.height}`)
  }
}

// Every page of a demo tab carries the demo banner. It says nothing about the
// feature in the picture, and a real family never sees it.
async function hideDemoBanner(page) {
  await page.addStyleTag({ content: '[role="status"]:has(> span > svg) { display: none !important; }' })
}

// A fresh tab in the demo, in the given language. Entering the demo is a hard
// navigation that starts the family afresh, and so is any later page load, so
// everything after it moves through the app's own router (goTo) or by clicks.
async function openDemo(browser, lang, [width, height]) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 })
  await ctx.addInitScript((l) => window.localStorage.setItem('kaydo_lang', l), lang)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/demo`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL('**/home', { timeout: 20000 })
  await page.waitForTimeout(4000)
  await hideDemoBanner(page)
  return { ctx, page }
}

async function goTo(page, path) {
  await page.evaluate((to) => {
    window.history.pushState({}, '', to)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  // Data, lazy chunks and the decrypted pictures need a moment to settle.
  await page.waitForTimeout(3000)
  const now = new URL(page.url()).pathname
  if (now !== path) throw new Error(`Expected ${path}, landed on ${now}`)
}

// The best-of on a phone, the way it is watched: as a story, on its title
// slide while the month's photos drift behind it. Not paused, since pausing
// puts a "Paused" label in the corner; the title slide holds long enough.
async function captureBestOf(page) {
  await page.getByRole('button', { name: /best of/i }).first().click()
  await page.waitForURL('**/best-of/**')
  await page.waitForTimeout(2800)
  return page.screenshot({ type: 'png' })
}

// The print dialog, as a family with a hardcover-length book sees it. The
// demo's own scrapbook has two pages, which would put the "too few pages for
// a hardcover" notice in the picture, so it gets blank pages up to 24 first
// (23 pages plus the back cover Kaydo adds). The demo's note that it orders
// nothing, and the dimmed button that goes with it, are left out for the
// same reason as the banner.
async function capturePrintDialog(page) {
  await goTo(page, '/scrapbook/demo-scrapbook')
  const toolbar = page.locator('button[title]')
  const addPage = toolbar.filter({ has: page.locator('svg.lucide-plus') }).first()
  for (let i = 0; i < 21; i++) await addPage.click()
  await toolbar.filter({ has: page.locator('svg.lucide-printer') }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  await dialog.evaluate((el) => {
    // The demo note is the only notice that follows the privacy box.
    const privacy = el.querySelector('.bg-amber-50')
    privacy?.nextElementSibling?.remove()
    for (const button of el.querySelectorAll('button[disabled]')) button.style.opacity = '1'
  })
  await page.waitForTimeout(300)
  return dialog.screenshot({ type: 'png' })
}

async function main() {
  const executablePath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium'
  const browser = await chromium.launch({ executablePath })

  for (const lang of SCREENSHOT_LANGUAGES) {
    console.log(`\n${lang}`)
    for (const shot of Object.values(SCREENSHOTS)) {
      const { ctx, page } = await openDemo(browser, lang, shot.viewport)
      let png
      if (shot.name === 'best-of-mobile') png = await captureBestOf(page)
      else if (shot.name === 'print-dialog') png = await capturePrintDialog(page)
      else {
        if (shot.path !== '/home') await goTo(page, shot.path)
        png = await page.screenshot({ type: 'png' })
      }
      await save(png, shot, lang)
      await ctx.close()
    }
  }

  await browser.close()
  console.log('\n✅ Screenshots written to public/screenshots/')
}

main().catch((err) => {
  console.error('Capture failed:', err)
  process.exit(1)
})
