import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import MemoryDetail from './pages/MemoryDetail'
import AdminDashboard from './pages/AdminDashboard'
import AdminSettings from './pages/AdminSettings'

function ProtectedRoute({ children }) {
  const { isAuthenticated, authLoading } = useAuth()
  if (authLoading) return <LoadingScreen />
  if (!isAuthenticated) return <Navigate to="/" replace />
  return children
}

function AdminRoute({ children }) {
  const { isAdmin, authLoading } = useAuth()
  if (authLoading) return <LoadingScreen />
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-hearth-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-terra/30 border-t-terra rounded-full animate-spin" />
        <p className="text-hearth-muted text-sm font-medium">Loading…</p>
      </div>
    </div>
  )
}

function AppRoutes() {
  const { isAuthenticated, authLoading } = useAuth()

  if (authLoading) return <LoadingScreen />

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/"
        element={isAuthenticated ? <Navigate to="/home" replace /> : <Login />}
      />

      {/* Inner circle + admin */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/home" element={<Home />} />
        <Route path="/memory/:id" element={<MemoryDetail />} />
      </Route>

      {/* Admin only */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <AdminRoute>
            <AdminSettings />
          </AdminRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
