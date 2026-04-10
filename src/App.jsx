import { lazy, Suspense, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import AdminMobileBottomNav from './components/layout/AdminMobileBottomNav'
import PWAInstallPrompt from './components/PWAInstallPrompt'
import NotificationPrompt from './components/NotificationPrompt'
import { listenForegroundMessages } from './utils/notifications'

import { getSubdomainSlug } from './utils/familySlug'

// Eagerly loaded — public pages served on first visit
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'

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

function SubdomainRedirect() {
  const subdomain = getSubdomainSlug()
  if (subdomain) {
    return <Navigate to="/login" replace />
  }
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

  return (
    <>
      {isAuthenticated && <NotificationPrompt familyId={familyId} />}

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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<SubdomainRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/family/:slug" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/memory/:id"
              element={
                <ProtectedRoute>
                  <MemoryDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/moments"
              element={
                <ProtectedRoute>
                  <MomentsAllPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/timeline"
              element={
                <ProtectedRoute>
                  <SmartTimelinePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/journal"
              element={
                <ProtectedRoute>
                  <KidsJournalPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/journal/:childId"
              element={
                <ProtectedRoute>
                  <JournalArchivePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/journal/:childId/new"
              element={
                <ProtectedRoute>
                  <JournalEntryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/journal/:childId/edit/:entryId"
              element={
                <ProtectedRoute>
                  <JournalEntryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/journal/:childId/view/:entryId"
              element={
                <ProtectedRoute>
                  <JournalDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/blackbox"
              element={
                <ProtectedRoute>
                  <BlackBoxPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/blackbox/new"
              element={
                <ProtectedRoute>
                  <CreateBlackBoxPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recipes"
              element={
                <ProtectedRoute>
                  <RecipesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recipes/new"
              element={
                <ProtectedRoute>
                  <CreateRecipePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recipes/:id"
              element={
                <ProtectedRoute>
                  <RecipeJourneyPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recipes/:id/fork"
              element={
                <ProtectedRoute>
                  <CreateRecipePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recipes/:rootId/version/:versionId"
              element={
                <ProtectedRoute>
                  <RecipeVersionDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/scrapbook"
              element={
                <ProtectedRoute>
                  <ScrapbooksPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/scrapbook/:id"
              element={
                <ProtectedRoute>
                  <ScrapbookEditorPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
        <AdminMobileBottomNav />
        <PWAInstallPrompt />
        <AppNotifications />
      </AuthProvider>
    </BrowserRouter>
  )
}
