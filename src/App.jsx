/* eslint-disable react-refresh/only-export-components --
   This module is the route-config entry for vite-react-ssg: it exports the
   `routes` table alongside the layout components it references, so the
   fast-refresh "components-only export" rule does not apply here. */
import { lazy, Suspense, useState, useEffect } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { Outlet, useNavigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import AdminMobileBottomNav from './components/layout/AdminMobileBottomNav'
import PWAInstallPrompt from './components/PWAInstallPrompt'
import NotificationPrompt from './components/NotificationPrompt'
import AnniversaryReminder from './components/AnniversaryReminder'
import { listenForegroundMessages, requestAndSaveFCMToken } from './utils/notifications'

import { getSubdomainSlug } from './utils/familySlug'

// Eagerly loaded — public pages served on first visit
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import InviteRedeemPage from './pages/InviteRedeemPage'

// Lazy loaded — protected pages, only needed after authentication
const HomePage = lazy(() => import('./pages/HomePage'))
const MemoryDetailPage = lazy(() => import('./pages/MemoryDetailPage'))
const MomentsAllPage = lazy(() => import('./pages/MomentsAllPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const KidsJournalPage = lazy(() => import('./pages/KidsJournalPage'))
const JournalArchivePage = lazy(() => import('./pages/JournalArchivePage'))
const JournalEntryPage = lazy(() => import('./pages/JournalEntryPage'))
const JournalDetailPage = lazy(() => import('./pages/JournalDetailPage'))
const BlackBoxPage = lazy(() => import('./pages/BlackBoxPage'))
const CreateBlackBoxPage = lazy(() => import('./pages/CreateBlackBoxPage'))
const RecipesPage = lazy(() => import('./pages/RecipesPage'))
const RecipeJourneyPage = lazy(() => import('./pages/RecipeJourneyPage'))
const RecipeVersionDetailPage = lazy(() => import('./pages/RecipeVersionDetailPage'))
const CreateRecipePage = lazy(() => import('./pages/CreateRecipePage'))
const ScrapbooksPage = lazy(() => import('./pages/ScrapbooksPage'))
const ScrapbookEditorPage = lazy(() => import('./pages/ScrapbookEditorPage'))
const SmartTimelinePage = lazy(() => import('./pages/SmartTimelinePage'))

// On a family subdomain (e.g. the-millers.kaydo.app) send visitors to /login;
// on the apex domain show the marketing landing page. The redirect runs in an
// effect (post-mount) so the server pre-render and the client's first render
// both produce <LandingPage /> — avoiding a hydration mismatch on the static
// "/" output, which is built for the apex.
function SubdomainRedirect() {
  const navigate = useNavigate()
  useEffect(() => {
    if (getSubdomainSlug()) {
      navigate('/login', { replace: true })
    }
  }, [navigate])
  return <LandingPage />
}

function PageLoader() {
  return <div className="min-h-screen bg-cream" aria-hidden="true" />
}

// Handles push notification prompt + in-app foreground toast.
// Must be inside AuthProvider to access familyId.
function AppNotifications() {
  const { familyId, isAuthenticated } = useAuth()
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!isAuthenticated) return
    const unsub = listenForegroundMessages(({ title, body }) => {
      setToast({ title, body })
      setTimeout(() => setToast(null), 5000)
    })
    return unsub
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
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}

// Root layout: providers + global UI shared by every route. The active route's
// element renders into <Outlet />. Replaces the old <BrowserRouter>/<Routes> tree
// so vite-react-ssg can drive the data router and pre-render static routes.
function Layout() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
      <AdminMobileBottomNav />
      <PWAInstallPrompt />
      <AppNotifications />
      <Analytics />
    </AuthProvider>
  )
}

// Helper to wrap a protected page element. Keeps the route table compact.
const protect = (element) => <ProtectedRoute>{element}</ProtectedRoute>

// Route table consumed by ViteReactSSG (src/main.jsx). Only the index route ("/")
// is pre-rendered to static HTML; all other routes stay client-side (see the
// includedRoutes filter in main.jsx).
export const routes = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <SubdomainRedirect /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'family/:slug', element: <LoginPage /> },
      { path: 'signup', element: <SignupPage /> },
      { path: 'invite', element: <InviteRedeemPage /> },
      { path: 'home', element: protect(<HomePage />) },
      { path: 'memory/:id', element: protect(<MemoryDetailPage />) },
      { path: 'moments', element: protect(<MomentsAllPage />) },
      { path: 'timeline', element: protect(<SmartTimelinePage />) },
      { path: 'settings', element: protect(<SettingsPage />) },
      { path: 'journal', element: protect(<KidsJournalPage />) },
      { path: 'journal/:childId', element: protect(<JournalArchivePage />) },
      { path: 'journal/:childId/new', element: protect(<JournalEntryPage />) },
      { path: 'journal/:childId/edit/:entryId', element: protect(<JournalEntryPage />) },
      { path: 'journal/:childId/view/:entryId', element: protect(<JournalDetailPage />) },
      { path: 'blackbox', element: protect(<BlackBoxPage />) },
      { path: 'blackbox/new', element: protect(<CreateBlackBoxPage />) },
      { path: 'recipes', element: protect(<RecipesPage />) },
      { path: 'recipes/new', element: protect(<CreateRecipePage />) },
      { path: 'recipes/:id', element: protect(<RecipeJourneyPage />) },
      { path: 'recipes/:id/fork', element: protect(<CreateRecipePage />) },
      { path: 'recipes/:rootId/version/:versionId', element: protect(<RecipeVersionDetailPage />) },
      { path: 'scrapbook', element: protect(<ScrapbooksPage />) },
      { path: 'scrapbook/:id', element: protect(<ScrapbookEditorPage />) },
    ],
  },
]
