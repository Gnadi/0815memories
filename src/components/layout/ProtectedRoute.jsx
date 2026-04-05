import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, familyId, keyLoading } = useAuth()

  // Show spinner while Firebase auth initialises OR while the encryption key is
  // being fetched for an authenticated session. The key-loading gate prevents any
  // protected page from rendering with a null encryptionKey, which would display
  // raw ciphertext or silently skip decryption.
  if (loading || (isAuthenticated && familyId && keyLoading)) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-hearth border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return children
}
