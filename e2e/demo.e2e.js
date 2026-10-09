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
