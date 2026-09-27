import { test, expect } from '@playwright/test'

// The admin seeded by scripts/seed-emulator.mjs.
const ADMIN_EMAIL = 'demo@kaydo.app'
const ADMIN_PASSWORD = 'demo123456'

// The login page renders a mobile and a desktop form; only one is visible.
const visible = (page, selector) => page.locator(`${selector}:visible`).first()

async function signIn(page, password = ADMIN_PASSWORD) {
  await page.goto('/login?admin=1')
  await visible(page, 'input[type="email"]').fill(ADMIN_EMAIL)
  await visible(page, 'input[type="password"]').fill(password)
  await visible(page, 'button[type="submit"]').click()
}

// Uncaught exceptions and console errors, collected for the whole test.
function collectErrors(page) {
  const errors = []
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
  })
  return errors
}

test('the landing page renders', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await expect(page.locator('h1')).toBeVisible()
  expect(errors).toEqual([])
})

test('a wrong password keeps the admin on the login page', async ({ page }) => {
  await signIn(page, 'not-the-password')
  await expect(page.getByText('Could not sign in').filter({ visible: true })).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

// Firebase keeps the session in IndexedDB, per page — so one sign-in, then
// every section in the same page. The app keeps a Firestore connection open,
// so the network never goes idle: wait for content, never for 'networkidle'.
test('an admin signs in and every section opens', async ({ page }) => {
  const errors = collectErrors(page)

  await signIn(page)
  await expect(page).toHaveURL(/\/home$/, { timeout: 20_000 })
  await expect(page.getByText('Summer at Monterey Bay').first()).toBeVisible()

  const sections = [
    ['/timeline', 'Smart Timeline'],
    ['/recipes', 'The Recipe Vault'],
    ['/scrapbook', 'Scrapbooks'],
    ['/blackbox', 'The Black Box'],
    ['/collages', 'Collages'],
    ['/highlights', 'Highlight video'],
    ['/our-year', 'Our Year'],
    ['/journal', 'A Gift for Their Future'],
    ['/settings', 'Settings'],
  ]
  for (const [path, heading] of sections) {
    await test.step(path, async () => {
      await page.goto(path)
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible()
    })
  }

  expect(errors).toEqual([])
})
