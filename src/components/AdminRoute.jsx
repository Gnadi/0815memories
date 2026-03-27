import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="loading-spinner" />
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/login" replace />
  }

  return children
}
