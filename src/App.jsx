import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import MemoryDetailPage from './pages/MemoryDetailPage'
import AlbumPage from './pages/AlbumPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import PostMemory from './pages/admin/PostMemory'

export default function App() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        color: 'var(--color-text-muted)'
      }}>
        Loading...
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/home" replace /> : <LoginPage />}
      />
      <Route
        path="/home"
        element={<ProtectedRoute><HomePage /></ProtectedRoute>}
      />
      <Route
        path="/memory/:id"
        element={<ProtectedRoute><MemoryDetailPage /></ProtectedRoute>}
      />
      <Route
        path="/album"
        element={<ProtectedRoute><AlbumPage /></ProtectedRoute>}
      />
      <Route
        path="/admin"
        element={<AdminRoute><AdminDashboard /></AdminRoute>}
      />
      <Route
        path="/admin/post"
        element={<AdminRoute><PostMemory /></AdminRoute>}
      />
      <Route
        path="/admin/post/:id"
        element={<AdminRoute><PostMemory /></AdminRoute>}
      />
      <Route path="*" element={<Navigate to={isAuthenticated ? '/home' : '/login'} replace />} />
    </Routes>
  )
}
