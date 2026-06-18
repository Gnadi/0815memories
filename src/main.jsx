import { ViteReactSSG } from 'vite-react-ssg'
import './index.css'
import { routes } from './routes'

// ViteReactSSG mounts (client) / renders to string (build) the data router.
export const createRoot = ViteReactSSG(
  { routes },
  ({ isClient }) => {
    // Service worker registration is client-only — virtual:pwa-register must
    // never execute during the Node prerender pass.
    if (isClient) {
      import('virtual:pwa-register').then(({ registerSW }) => {
        registerSW({ immediate: true })
      })
    }
  }
)

// Named export read by `vite-react-ssg build` to decide which paths to
// pre-render. Only the public marketing/info routes are baked to HTML; every
// dynamic or auth-gated route is excluded and keeps working as a client SPA.
export function includedRoutes(paths) {
  // vite-react-ssg passes route paths relative to the parent ("login", not
  // "/login"); "/" is the index. Whitelist only the public static pages.
  const allow = new Set(['/', 'login', 'signup'])
  return paths.filter((path) => allow.has(path))
}
