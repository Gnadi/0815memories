import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * @param adminOnly  for routes whose collections firestore.rules gates on
 *   isFamilyAdmin. Without it a viewer could open the page by URL, mount a
 *   listener the rules deny, and sit looking at a blank screen — which is what
 *   /scrapbook did. Several pages had grown their own `if (!isAdmin) navigate`
 *   effect for exactly this; those stay as belt-and-braces.
 */
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, loading, familyId, keyLoading, isAdmin } = useAuth()

  // Show spinner while Firebase auth initialises OR while the encryption key is
  // being fetched for an authenticated session. The key-loading gate prevents any
  // protected page from rendering with a null encryptionKey, which would display
  // raw ciphertext or silently skip decryption.
  if (loading || (isAuthenticated && familyId && keyLoading)) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-kaydo border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  // Home, rather than the landing page: a viewer is signed in and belongs here,
  // just not on this page.
  if (adminOnly && !isAdmin) {
    return <Navigate to="/home" replace />
  }

  return children
}
