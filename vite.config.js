import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
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
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        runtimeCaching: [
          // Firebase Auth + Firestore — network-first (always fresh data)
          {
            urlPattern: /^https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firebase-auth-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
            },
          },
          // Cloudinary — NetworkOnly: blobs are AES-256-GCM encrypted; the SW
          // can't serve them usefully from cache (the browser can't render raw
          // ciphertext), and serving a stale/opaque cached response breaks the
          // fetch→arrayBuffer()→decrypt pipeline in useDecryptedMedia.
          // The JS-layer module-level cache already handles in-session dedup.
          {
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          // Firebase Storage — same reasoning as Cloudinary above.
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
