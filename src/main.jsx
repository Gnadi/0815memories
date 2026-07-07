import { ViteReactSSG } from 'vite-react-ssg'
import './index.css'
import './i18n' // initialize i18next (runs in both Node pre-render and browser)
import { routes } from './App.jsx'

// None of our routes define a data loader, yet vite-react-ssg attaches a hidden
// loader to every route on server-rendered pages. On the first client-side
// navigation that loader fetches `static-loader-data-manifest-<hash>.json` and
// calls .json() on the response. When the open tab predates the latest deploy
// (common with the PWA — the service worker keeps the old index.html alive),
// the old hashed manifest no longer exists on the server, Vercel's SPA rewrite
// answers with index.html + HTTP 200, and .json() throws
//   SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
// inside the router — crashing an otherwise healthy page into the error screen.
// Pre-seeding the manifest as empty tells vite-react-ssg "no route has static
// loader data" (true for us — the emitted data files contain only nulls), so
// the fetch never happens at all. Remove this only if a route gains a real
// SSG-time loader whose data must be delivered to the client.
if (typeof window !== 'undefined') {
  window.__VITE_REACT_SSG_STATIC_LOADER_MANIFEST__ = {}
  window.__VITE_REACT_SSG_STATIC_LOADER_DATA__ = {}
}

// Pre-render only the public marketing landing page to static HTML. All other
// routes (auth + protected app) stay client-side rendered. vite-react-ssg reads
// this as a named export from the entry module.
export const includedRoutes = (paths) => paths.filter((path) => path === '/')

export const createRoot = ViteReactSSG(
  { routes },
  ({ isClient }) => {
    // Register the PWA service worker only in the browser, never during the
    // Node pre-render pass.
    if (isClient) {
      import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }))
    }
  },
)
