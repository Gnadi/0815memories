import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import AdminMobileBottomNav from './components/layout/AdminMobileBottomNav'

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

function PageLoader() {
  return <div className="min-h-screen bg-cream" aria-hidden="true" />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
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
      </AuthProvider>
    </BrowserRouter>
  )
}
