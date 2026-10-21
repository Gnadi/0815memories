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

// In a browser set to English: the address decides.
test('the landing page renders in German at /de', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/de')
  await expect(page.locator('h1')).toContainText('Zuhause')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  expect(errors).toEqual([])
})

test('a wrong password keeps the admin on the login page', async ({ page }) => {
  await signIn(page, 'not-the-password')
  await expect(page.getByText('Could not sign in').filter({ visible: true })).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

// The whole reset, against the Auth emulator: the login page asks for the mail,
// the emulator keeps the link it would send, and the new password replaces the
// old one. A throwaway account, so the seeded admin keeps its password for the
// other tests.
const AUTH_EMULATOR = 'http://127.0.0.1:9099'
const identityToolkit = (method) =>
  `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:${method}?key=demo-api-key`

test('an admin resets a forgotten password', async ({ page, request }) => {
  const errors = collectErrors(page)
  const email = `reset-${Date.now()}@example.com`
  const signUp = await request.post(identityToolkit('signUp'), {
    data: { email, password: 'the-old-password', returnSecureToken: true },
  })
  expect(signUp.ok()).toBe(true)

  await page.goto('/login?admin=1')
  await visible(page, 'input[type="email"]').fill(email)
  await page.getByRole('button', { name: 'Forgot password?' }).filter({ visible: true }).click()
  await expect(visible(page, 'input[type="email"]')).toHaveValue(email)
  await page.getByRole('button', { name: 'Send reset link' }).filter({ visible: true }).click()
  await expect(page.getByRole('status').filter({ visible: true })).toContainText(email)

  const listed = await request.get(`${AUTH_EMULATOR}/emulator/v1/projects/demo-kaydo/oobCodes`)
  const code = (await listed.json()).oobCodes
    .find((c) => c.email === email && c.requestType === 'PASSWORD_RESET')
  expect(code).toBeTruthy()

  const reset = await request.post(identityToolkit('resetPassword'), {
    data: { oobCode: code.oobCode, newPassword: 'the-new-password' },
  })
  expect(reset.ok()).toBe(true)

  const signIn = (password) => request.post(identityToolkit('signInWithPassword'), {
    data: { email, password, returnSecureToken: true },
  })
  expect((await signIn('the-old-password')).ok()).toBe(false)
  expect((await signIn('the-new-password')).ok()).toBe(true)
  expect(errors).toEqual([])
})

// An address without an account is answered like one with an account, and no
// mail is sent for it.
test('a password reset does not tell whether an account exists', async ({ page, request }) => {
  const email = `nobody-${Date.now()}@example.com`
  await page.goto('/login?admin=1')
  await visible(page, 'input[type="email"]').fill(email)
  await page.getByRole('button', { name: 'Forgot password?' }).filter({ visible: true }).click()
  await page.getByRole('button', { name: 'Send reset link' }).filter({ visible: true }).click()
  await expect(page.getByRole('status').filter({ visible: true }))
    .toContainText(`If ${email} belongs to a Kaydo admin account`)

  const listed = await request.get(`${AUTH_EMULATOR}/emulator/v1/projects/demo-kaydo/oobCodes`)
  expect((await listed.json()).oobCodes.some((c) => c.email === email)).toBe(false)
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

  // The seed shares its recipe with the viewers: they read it, every version
  // of it, and are offered nothing that would write.
  await test.step('/recipes', async () => {
    const errors = collectErrors(page)
    await goTo(page, '/recipes')
    await expect(page.getByRole('heading', { name: 'The Recipe Vault' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add a Recipe' })).toHaveCount(0)

    await page.getByText("Grandma Rose's Apple Pie").first().click()
    await expect(page).toHaveURL(/\/recipes\/recipe-root$/)
    await expect(page.getByText("Emma's Mini Pies").first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Fork This Recipe' })).toHaveCount(0)
    await expect(page.getByText('Visible to viewers')).toHaveCount(0)
    expect(errors).toEqual([])
  })

  // Their own device's settings, and none of the family's.
  await test.step('/settings', async () => {
    const errors = collectErrors(page)
    await goTo(page, '/settings')
    await expect(page).toHaveURL(/\/settings$/)
    await expect(page.getByRole('heading', { name: 'Your settings' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Admin Settings' })).toHaveCount(0)
    expect(errors).toEqual([])
  })
})
