import { useEffect } from 'react'
import { useRouteError } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import KaydoLogo from './KaydoLogo'

// A tab that predates the latest deploy references hashed assets (lazy route
// chunks, CSS, vite-react-ssg data files) that no longer exist on the server.
// Vercel's SPA rewrite answers those requests with index.html, so the failure
// surfaces as one of these messages rather than a plain 404.
const STALE_DEPLOY_PATTERNS = [
  /failed to fetch dynamically imported module/i, // Chrome
  /error loading dynamically imported module/i, // Firefox
  /importing a module script failed/i, // Safari
  /unable to preload css/i, // Vite's chunk-CSS preload helper
  /is not valid json/i, // Chrome, JSON.parse on an HTML response
  /json parse error/i, // Safari, same
  /loading( css)? chunk .* failed/i,
]

const RELOAD_GUARD_KEY = 'kaydo:stale-reload-at'

function isStaleDeployError(error) {
  const message = error?.message || String(error ?? '')
  return STALE_DEPLOY_PATTERNS.some((re) => re.test(message))
}

// A stale tab recovers fully by reloading: the fresh index.html references the
// assets of the current deploy. Reload at most once per minute so a genuinely
// broken deploy degrades to the visible error screen instead of a reload loop.
function shouldAutoReload() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0)
    if (Date.now() - last < 60_000) return false
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
    return true
  } catch {
    return false
  }
}

// Catches errors thrown during routing (chunk loads, loaders, render) that the
// default react-router boundary would show as a raw stack trace.
export default function RouteErrorScreen() {
  const error = useRouteError()
  const { t } = useTranslation('common')

  const autoReloading = isStaleDeployError(error) && shouldAutoReload()

  useEffect(() => {
    if (autoReloading) window.location.reload()
  }, [autoReloading])

  useEffect(() => {
    if (import.meta.env.DEV) console.error('Route error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center">
      <KaydoLogo size={40} className="mb-6" />
      {autoReloading ? (
        <p className="text-bark-light text-sm">{t('errorScreen.updating')}</p>
      ) : (
        <>
          <h1 className="text-xl font-semibold text-bark mb-2">{t('errorScreen.title')}</h1>
          <p className="text-bark-light text-sm max-w-sm mb-6 leading-relaxed">
            {t('errorScreen.message')}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-kaydo hover:bg-kaydo-dark text-warm-white font-medium rounded-xl px-6 py-3 transition-colors"
          >
            {t('errorScreen.reload')}
          </button>
        </>
      )}
    </div>
  )
}
