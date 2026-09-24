import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkOnly } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

// Take control immediately on update. This SW is built with the `injectManifest`
// strategy, so — unlike `generateSW` — vite-plugin-pwa does NOT auto-inject the
// skip-waiting / claim logic that `registerType: 'autoUpdate'` relies on. Without
// it, a freshly deployed worker installs but stays *waiting* for as long as any
// tab is open. Mobile Chrome keeps the tab's process alive for days, so the stale
// worker keeps serving the old precached index.html, whose hashed <script> was
// removed by the new deploy → the module 404s → React never hydrates → the
// pre-rendered landing-page buttons (all onClick handlers) silently do nothing.
// skipWaiting() + clientsClaim() make each new worker activate and take over
// open clients right away, keeping the served HTML and its JS bundles in sync.
self.skipWaiting()
clientsClaim()

// autoUpdate posts a SKIP_WAITING message when a new worker is found; honour it
// so control transfers without waiting for every tab to close.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// Precache the app shell injected by vite-plugin-pwa — not the whole app; see
// scripts/shellPrecache.mjs.
precacheAndRoute(self.__WB_MANIFEST)

// Everything else the build produced — route chunks, the editors, the PDF and
// ZIP libraries, the decrypt worker — is cached the first time a page needs it.
// Their names carry a content hash, so a cached copy is never stale; a chunk a
// new deploy removed is what RouteErrorScreen's reload is for. Registered after
// precacheAndRoute, which answers for the shell first.
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    url.pathname.startsWith('/assets/') &&
    ['script', 'style', 'worker'].includes(request.destination),
  new CacheFirst({
    cacheName: 'app-chunks',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 80, purgeOnQuotaError: true }),
    ],
  })
)

// Firebase Auth and Firestore are deliberately not routed here — nothing is
// cached for them, so they go straight to the network.
//
// They used to be NetworkFirst. That bought nothing: Firestore's listen channel
// is a GET with a fresh session id in every URL, so a cached response could
// never be served back, and Auth's token calls are POSTs Workbox does not cache
// anyway. What it did do was write every Firestore response into Cache Storage
// on disk — the family document with its encryption key among them — where it
// outlived logout. Those caches are deleted below, on devices that have them.
const RETIRED_CACHES = ['firestore-cache', 'firebase-auth-cache']

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all(RETIRED_CACHES.map((name) => caches.delete(name))))
})

// Encrypted media on Cloudinary — CacheFirst.
//
// These blobs are never handed to the renderer as-is: useDecryptedMedia reads
// them with fetch().arrayBuffer() and decrypts them in the page. A cached
// ciphertext deserialises exactly like a freshly fetched one, and it is the
// same ciphertext Cloudinary serves to anyone with the URL, so caching it adds
// no exposure — the plaintext still only ever exists in memory. What it does
// remove is a full re-download of every photo on every reload, since the
// in-memory decrypted cache dies with the page.
//
// statuses: [200] only. An opaque (status 0) cross-origin response cannot be
// read into an ArrayBuffer, so caching one would permanently poison the
// decrypt path for that URL.
registerRoute(
  ({ url }) =>
    /^https:\/\/res\.cloudinary\.com\//i.test(url.href) && /\/raw\/upload\//i.test(url.pathname),
  new CacheFirst({
    cacheName: 'encrypted-media-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({
        maxEntries: 300,
        maxAgeSeconds: 60 * 60 * 24 * 30,
        purgeOnQuotaError: true,
      }),
    ],
  })
)

// Everything else on Cloudinary is unencrypted (login header images, legacy
// uploads) and stays on the network so edits show up immediately.
registerRoute(
  ({ url }) => /^https:\/\/res\.cloudinary\.com\//i.test(url.href),
  new NetworkOnly()
)

// Firebase Storage — left on the network: nothing distinguishes encrypted from
// unencrypted objects by URL here.
registerRoute(
  ({ url }) => /^https:\/\/firebasestorage\.googleapis\.com\//i.test(url.href),
  new NetworkOnly()
)

// Handle incoming FCM push messages when the app is in the background or closed.
// The backend sends data-only messages so we control the notification display here.
// FCM wraps the payload under a 'data' key: { data: { title, body, url } }
// Fall back to the flat structure in case the format changes.
// Kaydo's own pushes are JSON. Anything else — DevTools' "Push" button sends
// plain text — used to throw here, and a push that shows no notification makes
// the browser show its own "this site has been updated in the background".
function readPushPayload(event) {
  try {
    return event.data?.json() ?? {}
  } catch {
    return { body: event.data?.text() ?? '' }
  }
}

self.addEventListener('push', (event) => {
  const payload = readPushPayload(event)
  const d = payload.data ?? payload
  const title = d.title || 'Kaydo'
  const options = {
    body: d.body || '',
    icon: '/icons/pwa-192x192.png',
    badge: '/icons/pwa-192x192.png',
    data: { url: d.url || '/' },
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
