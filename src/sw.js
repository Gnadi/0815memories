import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, NetworkOnly } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

// Precache all assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST)

// Firebase Auth + Firestore — network-first (always fresh data)
registerRoute(
  ({ url }) => /^https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\//i.test(url.href),
  new NetworkFirst({
    cacheName: 'firebase-auth-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 })],
  })
)

registerRoute(
  ({ url }) => /^https:\/\/firestore\.googleapis\.com\//i.test(url.href),
  new NetworkFirst({
    cacheName: 'firestore-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 5 })],
  })
)

// Cloudinary — NetworkOnly: blobs are AES-256-GCM encrypted; the SW
// can't serve them usefully from cache (the browser can't render raw
// ciphertext), and serving a stale/opaque cached response breaks the
// fetch→arrayBuffer()→decrypt pipeline in useDecryptedMedia.
registerRoute(
  ({ url }) => /^https:\/\/res\.cloudinary\.com\//i.test(url.href),
  new NetworkOnly()
)

// Firebase Storage — same reasoning as Cloudinary above.
registerRoute(
  ({ url }) => /^https:\/\/firebasestorage\.googleapis\.com\//i.test(url.href),
  new NetworkOnly()
)

// Handle incoming FCM push messages when the app is in the background or closed.
// The backend sends data-only messages so we control the notification display here.
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title || 'Kaydo'
  const options = {
    body: data.body || '',
    icon: '/icons/pwa-192x192.png',
    badge: '/icons/pwa-192x192.png',
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// When user taps a notification, open the app at the relevant URL.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If the app is already open, focus it and navigate
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus()
          if ('navigate' in client) client.navigate(url)
          return
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
