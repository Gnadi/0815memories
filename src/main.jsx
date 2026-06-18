import { ViteReactSSG } from 'vite-react-ssg'
import './index.css'
import { routes } from './App.jsx'

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
