/**
 * Capture the landing page screenshots that come from the browser demo
 * (`/demo`) rather than the seeded emulator: the monthly best-of and the
 * printed-book dialog. The seed has no best-of, and the demo family has one
 * of last month every time it starts, so the demo is where both can be shown.
 *
 * Prerequisites:
 *   VITE_PEECHO_ENABLED=true npm run dev      (serves on http://localhost:5173)
 * Then: node scripts/capture-demo-screenshots.mjs
 *
 * Printing has to be switched on for the Print button to exist at all. Uses
 * the pre-installed Chromium (CHROMIUM_PATH, or /opt/pw-browsers/chromium).
 * Output: optimized .webp files in public/screenshots/ (committed, shipped).
 */
import { chromium } from 'playwright'
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.env.CAPTURE_BASE_URL || 'http://localhost:5173'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'screenshots')

async function save(png, name, width) {
  const dest = join(OUT_DIR, `${name}.webp`)
  await sharp(png).resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toFile(dest)
  console.log(`  ✔ ${name}.webp`)
}

// Every page of a demo tab carries the demo banner. It says nothing about the
// feature in the picture, and a real family never sees it.
async function hideDemoBanner(page) {
  await page.addStyleTag({ content: '[role="status"]:has(> span > svg) { display: none !important; }' })
}

// Entering the demo is a hard navigation that starts the family afresh, and
// so is any later page load. Everything after it is clicked through in the
// app, never navigated to.
async function enterDemo(page) {
  await page.goto(`${BASE}/demo`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL('**/home', { timeout: 20000 })
  await page.waitForTimeout(4000)
  await hideDemoBanner(page)
}

// The best-of on a phone, the way it is watched: as a story, on its title
// slide while the month's photos drift behind it. Not paused, since pausing
// puts a "Paused" label in the corner; the title slide holds long enough.
async function captureBestOf(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  await enterDemo(page)
  await page.getByRole('button', { name: /best of/i }).first().click()
  await page.waitForURL('**/best-of/**')
  await page.waitForTimeout(2800)
  await save(await page.screenshot({ type: 'png' }), 'best-of-mobile', 440)
  await ctx.close()
}

// The print dialog, as a family with a hardcover-length book sees it. The
// demo's own scrapbook has two pages, which would put the "too few pages for
// a hardcover" notice in the picture, so it gets blank pages up to 24 first
// (23 pages plus the back cover Kaydo adds). The demo's note that it orders
// nothing, and the dimmed button that goes with it, are left out for the
// same reason as the banner.
async function capturePrintDialog(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  await enterDemo(page)
  await page.getByText('Scrapbooks', { exact: true }).first().click()
  await page.getByText('Our Family Year').first().click()
  await page.waitForTimeout(3000)
  const addPage = page.getByTitle('Add page').first()
  for (let i = 0; i < 21; i++) await addPage.click()
  await page.getByTitle('Order as a printed book').click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  await dialog.evaluate((el) => {
    for (const note of el.querySelectorAll('p, div')) {
      if (note.textContent.trim().startsWith('The demo does not order')) note.remove()
    }
    for (const button of el.querySelectorAll('button[disabled]')) button.style.opacity = '1'
  })
  await page.waitForTimeout(300)
  await save(await dialog.screenshot({ type: 'png' }), 'print-dialog', 640)
  await ctx.close()
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const executablePath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium'
  const browser = await chromium.launch({ executablePath })
  await captureBestOf(browser)
  await capturePrintDialog(browser)
  await browser.close()
  console.log('\n✅ Screenshots written to public/screenshots/')
}

main().catch((err) => {
  console.error('Capture failed:', err)
  process.exit(1)
})
