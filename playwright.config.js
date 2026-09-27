import { defineConfig, devices } from '@playwright/test'

// End-to-end smoke tests: the real app in a real browser, against the Firebase
// emulators seeded by scripts/seed-emulator.mjs. Run them with
// `npm run test:e2e`, which starts the emulators, seeds them and then runs
// Playwright; Playwright starts the Vite dev server itself.
//
// The dev server, not the production build: only a dev build may talk to the
// emulators (see src/config/firebase.js).
//
// Files are *.e2e.js rather than *.spec.js so Vitest does not pick them up.

const PORT = 5174

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.js',
  // One seeded family, shared by every test — no parallel writers.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Where a Chromium is already installed (the Claude Code cloud
        // container: /opt/pw-browsers/chromium), use it instead of downloading.
        launchOptions: process.env.CHROMIUM_PATH
          ? { executablePath: process.env.CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Placeholders: with VITE_USE_EMULATOR only the project id has to be
    // real, and it must match .firebaserc.
    env: {
      VITE_USE_EMULATOR: 'true',
      VITE_FIREBASE_API_KEY: 'demo-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-kaydo.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'demo-kaydo',
      VITE_FIREBASE_APP_ID: 'demo-app-id',
    },
  },
})
