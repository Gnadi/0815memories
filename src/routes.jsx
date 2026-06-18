/* eslint-disable react-refresh/only-export-components -- route config module, not a fast-refresh component file */
import { lazy, Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import AdminMobileBottomNav from './components/layout/AdminMobileBottomNav'
import PWAInstallPrompt from './components/PWAInstallPrompt'
import AppNotifications from './components/AppNotifications'
import SubdomainRedirect from './components/SubdomainRedirect'

// Eagerly loaded — public pages served on first visit (and pre-rendered).
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import InviteRedeemPage from './pages/InviteRedeemPage'

// Lazy loaded — protected pages, only needed after authentication.
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

function PageLoader() {
  return <div className="min-h-screen bg-cream" aria-hidden="true" />
}

// App shell shared by every route: auth context, suspense boundary for lazy
// pages, and the always-mounted global widgets. Rendered via <Outlet/>.
function RootLayout() {
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

const protect = (element) => <ProtectedRoute>{element}</ProtectedRoute>

export const routes = [
  {
    path: '/',
    element: <RootLayout />,
    children: [
      // Public routes (pre-rendered: index/login/signup).
      { index: true, element: <SubdomainRedirect /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'family/:slug', element: <LoginPage /> },
      { path: 'signup', element: <SignupPage /> },
      { path: 'invite', element: <InviteRedeemPage /> },

      // Protected routes — client-side only.
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
