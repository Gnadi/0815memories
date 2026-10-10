import { test, expect } from '@playwright/test'

// The demo family seeded by scripts/seed-emulator.mjs.
const ADMIN_EMAIL = 'demo@kaydo.app'
const ADMIN_PASSWORD = 'demo123456'
const FAMILY_SLUG = 'the-bennetts'
const VIEWER_PASSWORD = 'bennetts-family'

// The login page renders a mobile and a desktop form; only one is visible.
const visible = (page, selector) => page.locator(`${selector}:visible`).first()

async function signIn(page, password = ADMIN_PASSWORD) {
  await page.goto('/login?admin=1')
  await visible(page, 'input[type="email"]').fill(ADMIN_EMAIL)
  await visible(page, 'input[type="password"]').fill(password)
  await visible(page, 'button[type="submit"]').click()
}

// Pages the test is navigating away from, until the next one has replaced them.
const leaving = new WeakSet()

// Uncaught exceptions and console errors, collected for the whole test.
//
// Except from a page the test is leaving. Leaving cancels whatever that page
// still had in flight — the seeded family's pictures are fetched and decrypted
// like real ones — and the app logs each cancelled fetch as a failure. That is
// the test moving on, not the app failing. Everything the next page does is
// counted again from the moment it replaces the old one.
function collectErrors(page) {
  const errors = []
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) leaving.delete(page)
  })
  page.on('pageerror', (err) => {
    if (!leaving.has(page)) errors.push(`pageerror: ${err.message}`)
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !leaving.has(page)) errors.push(`console: ${msg.text()}`)
  })
  return errors
}

// page.goto, from a page whose errors collectErrors is collecting.
async function goTo(page, path) {
  leaving.add(page)
  await page.goto(path)
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
      await goTo(page, path)
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible()
    })
  }

  expect(errors).toEqual([])
})

// The trash, through the real rules: they let a document out and back in
// only as the same bytes, so this is where the client and the rules have to
// agree about what those are.
test("an admin's deleted memory waits in the trash, and comes back", async ({ page }) => {
  const errors = collectErrors(page)
  const title = 'Sunday in the Garden'
  // The feed's card shows the memory by its words; the title is on its page.
  const card = () => page.getByText('Leo planted his first tomatoes')

  await signIn(page)
  await expect(page).toHaveURL(/\/home$/, { timeout: 20_000 })
  leaving.add(page)
  await card().first().click()
  await expect(page).toHaveURL(/\/memory\//)
  await expect(page.getByText(title).first()).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Open menu' }).click()
  leaving.add(page)
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.getByText('Summer at Monterey Bay').first()).toBeVisible()
  await expect(card()).toHaveCount(0)

  await goTo(page, '/settings/trash')
  await expect(page.getByText(title)).toBeVisible()
  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByText('The trash is empty.')).toBeVisible()

  await goTo(page, '/home')
  await expect(card().first()).toBeVisible()
  expect(errors).toEqual([])
})

// Viewers have no account: the viewerLogin Cloud Function checks the shared
// family password and hands out a token for the family. So this runs through
// the Functions emulator as well as Firestore and Auth.
test('a viewer enters with the family password', async ({ page }) => {
  // The login page finds the family through familyPublic, which the
  // mirrorFamilyPublic trigger writes shortly after the seed.
  await expect(async () => {
    await page.goto(`/family/${FAMILY_SLUG}`)
    await expect(page.getByText('Welcome to The Bennett Family').filter({ visible: true })).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })

  const password = visible(page, 'input[type="password"]')
  await password.fill('not-the-password')
  await visible(page, 'button[type="submit"]').click()
  await expect(page.getByText('Invalid password').filter({ visible: true })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/family/${FAMILY_SLUG}$`))

  await password.fill(VIEWER_PASSWORD)
  await visible(page, 'button[type="submit"]').click()
  await expect(page).toHaveURL(/\/home$/, { timeout: 20_000 })
  await expect(page.getByText('Summer at Monterey Bay').first()).toBeVisible()
})
