import { test, expect } from '@playwright/test'

// The demo family at /demo (src/demo/). It runs entirely in the browser, so
// unlike smoke.e2e.js it needs neither the emulators nor the seed — and it
// must not reach them, or anything else outside the page, either.

function watch(page) {
  const errors = []
  const outside = []
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
  })
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.protocol.startsWith('http') && url.hostname !== 'localhost') outside.push(url.host)
  })
  return { errors, outside }
}

async function openDemo(page) {
  // Handing in Our Year answers asks for confirmation first.
  page.on('dialog', (dialog) => dialog.accept())
  await page.goto('/demo')
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.getByRole('status').filter({ hasText: 'demo family' })).toBeVisible()
}

test('the demo family opens without an account, and every section with it', async ({ page }) => {
  const { errors, outside } = watch(page)
  await openDemo(page)
  await expect(page.getByText('Summer at Monterey Bay').first()).toBeVisible()
  await expect(page.getByText('Breakfast').first()).toBeVisible()

  const sections = [
    ['/timeline', 'Smart Timeline'],
    ['/recipes', "Grandma Rose's Apple Pie"],
    ['/scrapbook', 'Our Family Year'],
    ['/blackbox', "For Emma's 18th birthday"],
    ['/collages', 'Summer at the bay'],
    ['/highlights', 'Our summers'],
    ['/our-year', 'A year of small adventures'],
    ['/journal', 'Emma'],
    ['/journal/demo-emma', 'First day of school'],
    ['/settings', 'Settings'],
  ]
  for (const [path, text] of sections) {
    await page.goto(path)
    await expect(page.getByText(text).first(), path).toBeVisible()
  }

  expect(outside).toEqual([])
  expect(errors).toEqual([])
})

test("last month's best-of is put together in the tab and plays as a story", async ({ page }) => {
  const { errors, outside } = watch(page)
  await openDemo(page)
  // The demo family has last month's photos (demo/demoFamily.js); opening the
  // circle makes the best-of there and then, soundtrack and all — which must
  // need nothing from outside this origin.
  await page.getByTestId('bestof-circle').click()
  await expect(page).toHaveURL(/\/best-of\/\d{4}-\d{2}$/)
  await expect(page.getByTestId('bestof-slide-intro')).toBeVisible({ timeout: 45_000 })
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('bestof-slide-count')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/home$/)

  expect(outside).toEqual([])
  expect(errors).toEqual([])
})

test('what the visitor adds stays in the tab until a reload', async ({ page }) => {
  await openDemo(page)
  await page.goto('/journal')
  await page.getByRole('button', { name: 'Add New Child' }).click()
  await page.getByPlaceholder('e.g. Leo').fill('Mia')
  await page.locator('form input[type="date"]').fill('2023-03-14')
  await page.locator('form button[type="submit"]').click()
  await expect(page.getByText('Mia', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByText('Emma', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Mia', { exact: true })).toHaveCount(0)
})

test("the visitor's answers reveal the partner's, and the time locks hold", async ({ page }) => {
  await openDemo(page)
  await page.goto('/our-year/demo-chapter-3')
  const answers = page.locator('textarea')
  await expect(answers.first()).toBeVisible()
  for (let i = 0; i < 5; i++) await answers.nth(i).fill(`Answer ${i + 1}`)
  await page.getByRole('button', { name: "I'm done" }).first().click()
  await expect(page.getByText('Watching you teach Leo to ride').first()).toBeVisible()

  await page.goto('/blackbox')
  await expect(page.getByText('Sealed until').first()).toBeVisible()
})

test('server-only features say so, and leaving the demo ends it', async ({ page }) => {
  await openDemo(page)
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Generate invite link' }).click()
  await expect(page.getByText('Not in the demo').first()).toBeVisible()

  await page.getByRole('button', { name: 'Leave the demo' }).click()
  await expect(page).toHaveURL(/\/$/)
  expect(await page.evaluate(() => sessionStorage.getItem('kaydo_demo'))).toBeNull()
  await page.goto('/home')
  await expect(page).toHaveURL(/\/$/)
})

test.describe('on a phone', () => {
  // isMobile matters: only a mobile browser widens its layout viewport to fit
  // content that overflows the page, which is what hid the memory form.
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('a collage turned into a memory opens its form on screen', async ({ page }) => {
    const { errors } = watch(page)
    await openDemo(page)
    await page.goto('/collage/demo-collage-1')
    await expect(page.getByRole('button', { name: 'More options' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

    await page.getByRole('button', { name: 'More options' }).click()
    await page.getByRole('button', { name: 'Create memory' }).click()
    const heading = page.getByRole('heading', { name: 'Post a Memory' })
    await expect(heading).toBeInViewport()
    expect(await page.evaluate(() => window.innerWidth)).toBe(390)
    // The form opens before the collage is rendered; the photo follows.
    await expect(page.locator('img[src^="blob:"]').first()).toBeVisible()
    expect(errors).toEqual([])
  })
})
