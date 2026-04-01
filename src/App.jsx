import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import AdminMobileBottomNav from './components/layout/AdminMobileBottomNav'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import HomePage from './pages/HomePage'
import MemoryDetailPage from './pages/MemoryDetailPage'
import MomentsAllPage from './pages/MomentsAllPage'
import SettingsPage from './pages/SettingsPage'
import KidsJournalPage from './pages/KidsJournalPage'
import JournalArchivePage from './pages/JournalArchivePage'
import JournalEntryPage from './pages/JournalEntryPage'
import JournalDetailPage from './pages/JournalDetailPage'
import BlackBoxPage from './pages/BlackBoxPage'
import CreateBlackBoxPage from './pages/CreateBlackBoxPage'
import RecipesPage from './pages/RecipesPage'
import RecipeJourneyPage from './pages/RecipeJourneyPage'
import CreateRecipePage from './pages/CreateRecipePage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
        </Routes>
        <AdminMobileBottomNav />
      </AuthProvider>
    </BrowserRouter>
  )
}
