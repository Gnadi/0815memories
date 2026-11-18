import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { shellPrecache } from './scripts/shellPrecache.mjs'
import { inlineStylesheet } from './scripts/inlineCss.mjs'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
  },
  ssgOptions: {
    // Stamp each pre-rendered page with the path it was built for. index.html's
    // inline script compares it with the URL to tell a page served its own HTML
    // from one served another page's as the SPA fallback (see
    // src/utils/prehydrationCover.js). The stylesheet goes into the page, so the
    // first paint does not wait for a second request (scripts/inlineCss.mjs).
    onPageRendered: (path, html) =>
      inlineStylesheet(
        html.replace('<html', `<html data-prerendered="${path}"`),
        (href) => readFileSync(fileURLToPath(new URL(`./dist${href}`, import.meta.url)), 'utf8'),
      ),
  },
  build: {
    // The pre-rendered landing page ("/") paints from HTML + CSS alone. Vite's
    // automatic <link rel="modulepreload"> hints in the HTML would fetch the
    // whole app JS graph (~300 KB) at high priority ahead of it; measured with
    // them, its largest paint came 380 ms later on a throttled phone. So the
    // HTML gets none, and the app JS loads to hydrate after the first paint.
    //
    // A dynamic import is another matter. Without the list of what the chunk
    // imports, each level of a lazy page's imports was found only once the level
    // above had arrived: three more round trips after HomePage's own. With the
    // list, they load side by side — the first photo on /home came about 350 ms
    // sooner on the same throttled phone.
    modulePreload: {
      polyfill: false,
      resolveDependencies: (_filename, deps, { hostType }) => (hostType === 'html' ? [] : deps),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // The app shell only — see scripts/shellPrecache.mjs. og-image.png is for
      // link previews, which crawlers fetch; nothing in the app shows it.
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      injectManifest: {
        manifestTransforms: [
          shellPrecache(fileURLToPath(new URL('./dist/.vite/manifest.json', import.meta.url))),
        ],
      },
      manifest: {
        name: 'Kaydo',
        short_name: 'Kaydo',
        description: 'A private, encrypted sanctuary for your family\'s memories. No ads, no AI training — just your stories, preserved forever.',
        theme_color: '#C25A2E',
        background_color: '#FDF6EC',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['lifestyle', 'family', 'photo'],
        icons: [
          {
            src: '/icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
