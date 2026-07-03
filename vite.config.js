import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
  },
  build: {
    // The pre-rendered landing page ("/") paints from HTML + CSS alone. Vite's
    // automatic <link rel="modulepreload"> hints would otherwise fetch the whole
    // app JS graph (~300 KB) at high priority, starving the render-blocking CSS
    // on a throttled connection and pushing out First Contentful Paint. The app
    // JS still loads to hydrate — just after the first paint, not before it.
    modulePreload: false,
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
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png', 'og-image.png'],
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
