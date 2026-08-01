/**
 * Capture real app screenshots for the landing page.
 *
 * Prerequisites (see scripts/seed-emulator.mjs):
 *   1) npx firebase-tools emulators:start --only auth,firestore --project demo-kaydo
 *   2) node scripts/seed-emulator.mjs
 *   3) VITE_USE_EMULATOR=true npm run dev      (serves on http://localhost:5173)
 * Then: node scripts/capture-screenshots.mjs
 *
 * Uses the pre-installed Chromium (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers).
 * Output: optimized .webp files in public/screenshots/ (committed, shipped).
 */
import { chromium } from 'playwright'
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.env.CAPTURE_BASE_URL || 'http://localhost:5173'
const ADMIN_EMAIL = 'demo@kaydo.app'
const ADMIN_PASSWORD = 'demo123456'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'screenshots')

// name → { path, width, height, maxWidth (output) }
const SHOTS = [
  { name: 'home-desktop', path: '/home', width: 1280, height: 800, out: 1200 },
  { name: 'home-mobile', path: '/home', width: 390, height: 844, out: 440 },
  { name: 'scrapbook-desktop', path: '/scrapbook/scrapbook-year', width: 1280, height: 800, out: 1200 },
  { name: 'recipe-tree-desktop', path: '/recipes/recipe-root', width: 1280, height: 800, out: 1200 },
  { name: 'journal-desktop', path: '/journal/child-emma', width: 1280, height: 800, out: 1200 },
  { name: 'blackbox-desktop', path: '/blackbox', width: 1280, height: 800, out: 1200 },
  // Taller than the rest on purpose: the point of this one is the timeline, so
  // the frame has to reach past the ritual header to a second chapter.
  { name: 'our-year-desktop', path: '/our-year', width: 1280, height: 1080, out: 1200 },
]

// Note: the app keeps an open Firestore websocket to the emulator, so the network
// never goes idle — we use 'domcontentloaded' + explicit settle waits, never
// 'networkidle'.
async function login(page) {
  await page.goto(`${BASE}/login?admin=1`, { waitUntil: 'domcontentloaded' })
  // The page renders both a mobile and a desktop form in the DOM; target the
  // visible one for the current viewport.
  await page.locator('input[type="email"]:visible').first().fill(ADMIN_EMAIL)
  await page.locator('input[type="password"]:visible').first().fill(ADMIN_PASSWORD)
  await Promise.all([
    page.waitForURL('**/home', { timeout: 20000 }),
    page.locator('button[type="submit"]:visible').first().click(),
  ])
  await page.waitForTimeout(2500)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  // Use the pre-installed Chromium rather than downloading one (offline env).
  const executablePath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium'
  const browser = await chromium.launch({ executablePath })

  // IMPORTANT: Firebase persists the auth session in IndexedDB, which is NOT
  // carried by Playwright's storageState. So we log in ONCE and reuse the SAME
  // page (just resizing the viewport) for every shot — otherwise a fresh context
  // would be unauthenticated and ProtectedRoute would redirect to the landing page.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  await login(page)

  for (const shot of SHOTS) {
    await page.setViewportSize({ width: shot.width, height: shot.height })
    await page.goto(`${BASE}${shot.path}`, { waitUntil: 'domcontentloaded' })
    // Give data load + lazy images / decryption fallback a beat to settle.
    await page.waitForTimeout(3000)
    // Guard against an unexpected redirect to the landing/login page (= not authed).
    const path = new URL(page.url()).pathname
    if (path === '/' || path.startsWith('/login')) {
      throw new Error(`Not authenticated for ${shot.name}: landed on ${path} (expected ${shot.path})`)
    }
    const png = await page.screenshot({ type: 'png' })
    const dest = join(OUT_DIR, `${shot.name}.webp`)
    await sharp(png).resize({ width: shot.out, withoutEnlargement: true }).webp({ quality: 82 }).toFile(dest)
    console.log(`  ✔ ${shot.name}.webp  (${path})`)
  }

  await ctx.close()
  await browser.close()
  console.log('\n✅ Screenshots written to public/screenshots/')
  process.exit(0)
}

main().catch((err) => {
  console.error('Capture failed:', err)
  process.exit(1)
})
