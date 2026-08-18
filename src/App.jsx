/* eslint-disable react-refresh/only-export-components --
   This module is the route-config entry for vite-react-ssg: it exports the
   `routes` table alongside the layout components it references, so the
   fast-refresh "components-only export" rule does not apply here. */
import { lazy, Suspense, useState, useEffect } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { Outlet, useNavigate } from 'react-router-dom'
import { I18nextProvider, useTranslation } from 'react-i18next'
import i18n, { ensureAppTranslations } from './i18n'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import AdminMobileBottomNav from './components/layout/AdminMobileBottomNav'
import PWAInstallPrompt from './components/PWAInstallPrompt'
import RouteErrorScreen from './components/RouteErrorScreen'
import NotificationPrompt from './components/NotificationPrompt'
import AnniversaryReminder from './components/AnniversaryReminder'
import { listenForegroundMessages, requestAndSaveFCMToken } from './utils/notifications'

import { getSubdomainSlug } from './utils/familySlug'
import { hasStoredSession } from './utils/authStorage'

// Eagerly loaded — public pages served on first visit
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import InviteRedeemPage from './pages/InviteRedeemPage'

// Every page below needs translation namespaces that are not in the startup
// bundle. Waiting for them here — inside the boundary React already suspends
// on — means a page never paints with raw translation keys, which is what a
// load-from-inside-a-hook approach would do (useSuspense is off for SSG).
const lazyPage = (loader) =>
  lazy(async () => {
    const [module] = await Promise.all([loader(), ensureAppTranslations()])
    return module
  })

// Lazy loaded — protected pages, only needed after authentication
const LegalPage = lazyPage(() => import('./pages/LegalPage'))
const HomePage = lazyPage(() => import('./pages/HomePage'))
const MemoryDetailPage = lazyPage(() => import('./pages/MemoryDetailPage'))
const MomentsAllPage = lazyPage(() => import('./pages/MomentsAllPage'))
const SettingsPage = lazyPage(() => import('./pages/SettingsPage'))
const LoginDesignerPage = lazyPage(() => import('./pages/LoginDesignerPage'))
const KidsJournalPage = lazyPage(() => import('./pages/KidsJournalPage'))
const JournalArchivePage = lazyPage(() => import('./pages/JournalArchivePage'))
const JournalEntryPage = lazyPage(() => import('./pages/JournalEntryPage'))
const JournalDetailPage = lazyPage(() => import('./pages/JournalDetailPage'))
const BlackBoxPage = lazyPage(() => import('./pages/BlackBoxPage'))
const CreateBlackBoxPage = lazyPage(() => import('./pages/CreateBlackBoxPage'))
const RecipesPage = lazyPage(() => import('./pages/RecipesPage'))
const RecipeJourneyPage = lazyPage(() => import('./pages/RecipeJourneyPage'))
const RecipeVersionDetailPage = lazyPage(() => import('./pages/RecipeVersionDetailPage'))
const CreateRecipePage = lazyPage(() => import('./pages/CreateRecipePage'))
const ScrapbooksPage = lazyPage(() => import('./pages/ScrapbooksPage'))
const ScrapbookEditorPage = lazyPage(() => import('./pages/ScrapbookEditorPage'))
const SmartTimelinePage = lazyPage(() => import('./pages/SmartTimelinePage'))
const CollagesPage = lazyPage(() => import('./pages/CollagesPage'))
const HighlightsPage = lazyPage(() => import('./pages/HighlightsPage'))
const CollageEditorPage = lazyPage(() => import('./pages/CollageEditorPage'))
const HighlightEditorPage = lazyPage(() => import('./pages/HighlightEditorPage'))
const OurYearPage = lazyPage(() => import('./pages/OurYearPage'))
const OurYearSetupPage = lazyPage(() => import('./pages/OurYearSetupPage'))
const OurYearChapterPage = lazyPage(() => import('./pages/OurYearChapterPage'))

// What "/" resolves to, in priority order:
//
//   1. A signed-in visitor goes straight to /home. "/" is where every return
//      visit starts — a bookmark, a tapped app icon, the PWA's start_url — and
//      showing the marketing page to someone who is already in their family
//      reads as having been logged out, even though the session is intact.
//   2. On a family subdomain (e.g. the-millers.kaydo.app), /login.
//   3. Otherwise the marketing landing page.
//
// Everything runs in an effect (post-mount) so the server pre-render and the
// client's first render both produce <LandingPage /> — avoiding a hydration
// mismatch on the static "/" output, which is built for the apex. The static
// HTML *is* the landing page, so it would still paint for the moment before
// hydration; index.html covers it with a cream shell for exactly that window
// (the .kaydo-restoring class, cleared below once this route has decided).
export function RootRoute() {
  const navigate = useNavigate()
  const { isAuthenticated, loading } = useAuth()
  // 'unknown'   — pre-hydration, storage not read yet (renders the landing page,
  //               matching the pre-rendered HTML byte for byte)
  // 'restoring' — a session is stored; hold a blank shell until auth confirms it
  // 'public'    — no session, or the stored one is stale: show the public page
  //
  // Whether a session exists is readable from storage on the first frame, long
  // before Firebase Auth has rehydrated its token, and holding the landing page
  // back for that moment is what keeps a returning member off the marketing
  // page. Storage cannot be read during the hydration render, hence the state:
  // both effects below are gated on it, so nothing redirects before the read
  // has happened.
  const [status, setStatus] = useState('unknown')

  useEffect(() => {
    const session = hasStoredSession()
    // Reading client-only storage after hydration is what this effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(session ? 'restoring' : 'public')
    // Nothing to wait for — send subdomain visitors on immediately, as before.
    if (!session && getSubdomainSlug()) navigate('/login', { replace: true })
  }, [navigate])

  useEffect(() => {
    if (status === 'unknown') return
    if (isAuthenticated) {
      navigate('/home', { replace: true })
      return
    }
    // Still rehydrating the auth token: keep holding.
    if (loading) return
    // Resolved as signed out — the stored family id outlived its session (signed
    // out in another tab, credentials revoked). Fall through to the public page.
    // The auth SDK is the external system this synchronizes with, and it has no
    // render-time read to derive from.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus('public')
    if (getSubdomainSlug()) navigate('/login', { replace: true })
  }, [status, isAuthenticated, loading, navigate])

  // Safety valve, mirroring LoginPage's: if auth never settles (blocked
  // IndexedDB, a stalled SDK init) the shell would otherwise be a permanently
  // blank page where the landing page used to be. Giving up shows the public
  // page; a late-arriving session still redirects via the effect above.
  useEffect(() => {
    if (status !== 'restoring') return
    const id = setTimeout(() => setStatus('public'), 5000)
    return () => clearTimeout(id)
  }, [status])

  // Uncover the page once this route knows what it is showing. Runs after the
  // commit that rendered the shell or the landing page, so the markup being
  // revealed is already the right one.
  useEffect(() => {
    if (status === 'unknown' || typeof document === 'undefined') return
    document.documentElement.classList.remove('kaydo-restoring')
  }, [status])

  if (status === 'restoring') return <PageLoader />
  return <LandingPage />
}

function PageLoader() {
  return <div className="min-h-screen bg-cream" aria-hidden="true" />
}

// Vercel's analytics script is only served on Vercel deployments; on localhost,
// the preview server, or any other host it 404s and logs a console error. Gate
// it to real hosts so it stays silent locally (and in Lighthouse runs) while
// still reporting from production.
function SiteAnalytics() {
  // Decided once at first render. On the server (pre-render) there is no window,
  // so it stays off; <Analytics /> emits no DOM either way, so there is no
  // hydration mismatch. Reads the host lazily to keep it out of an effect.
  const [enabled] = useState(() => {
    if (typeof window === 'undefined') return false
    const host = window.location.hostname
    return !(host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local'))
  })
  return enabled ? <Analytics /> : null
}

// Handles push notification prompt + in-app foreground toast.
// Must be inside AuthProvider to access familyId.
function AppNotifications() {
  const { familyId, isAuthenticated } = useAuth()
  const { t } = useTranslation('common')
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!isAuthenticated) return
    // The messaging SDK is code-split, so subscribing resolves a tick later.
    // Unsubscribing before then still has to work.
    let unsub = null
    let cancelled = false
    listenForegroundMessages(({ title, body }) => {
      setToast({ title, body })
      setTimeout(() => setToast(null), 5000)
    }).then((fn) => {
      if (cancelled) fn()
      else unsub = fn
    })
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [isAuthenticated])

  // Silently refresh the FCM token on each app load when the user already
  // granted notification permission (covers return visits where the prompt
  // won't show again because permission is no longer 'default').
  useEffect(() => {
    if (!isAuthenticated || !familyId) return
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'granted') {
      requestAndSaveFCMToken(familyId).catch(() => {})
    }
  }, [isAuthenticated, familyId])

  return (
    <>
      {isAuthenticated && <NotificationPrompt familyId={familyId} />}
      {isAuthenticated && <AnniversaryReminder />}

      {/* In-app toast for foreground push messages */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm bg-bark text-warm-white rounded-2xl shadow-xl px-4 py-3 flex items-start gap-3 animate-fade-in">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-snug">{toast.title}</p>
            {toast.body && <p className="text-xs opacity-80 mt-0.5 leading-relaxed">{toast.body}</p>}
          </div>
          <button
            onClick={() => setToast(null)}
            className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity mt-0.5"
            aria-label={t('actions.dismiss')}
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}

// Keeps the <html lang> attribute in sync with the active language. The static
// pre-rendered "/" stays "en" (no window during pre-render); this updates it
// client-side after hydration and on every language change.
function HtmlLangSync() {
  const { i18n: i18nInstance } = useTranslation()
  useEffect(() => {
    if (typeof document === 'undefined') return
    const apply = (lng) => {
      document.documentElement.lang = (lng || 'en').split('-')[0]
    }
    apply(i18nInstance.language)
    i18nInstance.on('languageChanged', apply)
    return () => i18nInstance.off('languageChanged', apply)
  }, [i18nInstance])
  return null
}

// Root layout: providers + global UI shared by every route. The active route's
// element renders into <Outlet />. Replaces the old <BrowserRouter>/<Routes> tree
// so vite-react-ssg can drive the data router and pre-render static routes.
function Layout() {
  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <HtmlLangSync />
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
        <AdminMobileBottomNav />
        <PWAInstallPrompt />
        <AppNotifications />
        <SiteAnalytics />
      </AuthProvider>
    </I18nextProvider>
  )
}

// Helper to wrap a protected page element. Keeps the route table compact.
const protect = (element) => <ProtectedRoute>{element}</ProtectedRoute>
// For pages backed by collections firestore.rules gates on isFamilyAdmin. A
// viewer reaching one by URL would otherwise mount a listener the rules deny
// and be left looking at nothing.
const protectAdmin = (element) => <ProtectedRoute adminOnly>{element}</ProtectedRoute>

// Route table consumed by ViteReactSSG (src/main.jsx). Only the index route ("/")
// is pre-rendered to static HTML; all other routes stay client-side (see the
// includedRoutes filter in main.jsx).
export const routes = [
  {
    path: '/',
    element: <Layout />,
    // Recovers stale tabs after a deploy (auto-reload) and turns any other
    // routing/render error into a branded screen instead of a raw stack trace.
    errorElement: <RouteErrorScreen />,
    children: [
      { index: true, element: <RootRoute /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'family/:slug', element: <LoginPage /> },
      { path: 'signup', element: <SignupPage /> },
      { path: 'invite', element: <InviteRedeemPage /> },

      // Public legal / informational pages (linked from the footer).
      { path: 'terms', element: <LegalPage docKey="terms" /> },
      { path: 'privacy-policy', element: <LegalPage docKey="privacy-policy" /> },
      { path: 'contact', element: <LegalPage docKey="contact" /> },
      { path: 'safety', element: <LegalPage docKey="safety" /> },
      { path: 'home', element: protect(<HomePage />) },
      { path: 'memory/:id', element: protect(<MemoryDetailPage />) },
      { path: 'moments', element: protect(<MomentsAllPage />) },
      { path: 'timeline', element: protect(<SmartTimelinePage />) },
      { path: 'settings', element: protectAdmin(<SettingsPage />) },
      { path: 'settings/login-designer', element: protectAdmin(<LoginDesignerPage />) },
      { path: 'journal', element: protectAdmin(<KidsJournalPage />) },
      { path: 'journal/:childId', element: protectAdmin(<JournalArchivePage />) },
      { path: 'journal/:childId/new', element: protectAdmin(<JournalEntryPage />) },
      { path: 'journal/:childId/edit/:entryId', element: protectAdmin(<JournalEntryPage />) },
      { path: 'journal/:childId/view/:entryId', element: protectAdmin(<JournalDetailPage />) },
      { path: 'blackbox', element: protectAdmin(<BlackBoxPage />) },
      { path: 'blackbox/new', element: protectAdmin(<CreateBlackBoxPage />) },
      { path: 'recipes', element: protectAdmin(<RecipesPage />) },
      { path: 'recipes/new', element: protectAdmin(<CreateRecipePage />) },
      { path: 'recipes/:id', element: protectAdmin(<RecipeJourneyPage />) },
      { path: 'recipes/:id/fork', element: protectAdmin(<CreateRecipePage />) },
      { path: 'recipes/:rootId/version/:versionId', element: protectAdmin(<RecipeVersionDetailPage />) },
      { path: 'scrapbook', element: protectAdmin(<ScrapbooksPage />) },
      { path: 'scrapbook/:id', element: protectAdmin(<ScrapbookEditorPage />) },
      // Collages and highlight videos — a gallery and an editor each.
      { path: 'collages', element: protectAdmin(<CollagesPage />) },
      { path: 'collage/:id', element: protectAdmin(<CollageEditorPage />) },
      { path: 'highlights', element: protectAdmin(<HighlightsPage />) },
      { path: 'highlight/:id', element: protectAdmin(<HighlightEditorPage />) },
      // "Our Year" — the couple's recurring review. Private to two people;
      // the pages and the security rules both enforce that.
      { path: 'our-year', element: protectAdmin(<OurYearPage />) },
      { path: 'our-year/setup', element: protectAdmin(<OurYearSetupPage />) },
      { path: 'our-year/:chapterId', element: protectAdmin(<OurYearChapterPage />) },
    ],
  },
]
