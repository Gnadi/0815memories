import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import HomePage from './pages/HomePage'
import MemoryDetailPage from './pages/MemoryDetailPage'
import MomentsAllPage from './pages/MomentsAllPage'
import SettingsPage from './pages/SettingsPage'
import KidsJournalPage from './pages/KidsJournalPage'
import JournalArchivePage from './pages/JournalArchivePage'
import BlackBoxPage from './pages/BlackBoxPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LoginPage />} />
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
            path="/blackbox"
            element={
              <ProtectedRoute>
                <BlackBoxPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
