import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import FamilyKeyError from './FamilyKeyError'
import UnlockScreen from '../UnlockScreen'
import { loginPathFor, safeNextPath } from '../../utils/nextPath'

/**
 * @param adminOnly  for routes whose collections firestore.rules gates on
 *   isFamilyAdmin. Without it a viewer could open the page by URL, mount a
 *   listener the rules deny, and sit looking at a blank screen — which is what
 *   /scrapbook did. Several pages had grown their own `if (!isAdmin) navigate`
 *   effect for exactly this; those stay as belt-and-braces.
 */
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, loading, familyId, keyLoading, keyError, isAdmin, isViewer } = useAuth()
  const location = useLocation()

  // The key will not come. The app used to open without it, and then wrote
  // family content in plaintext.
  if (!loading && isAuthenticated && keyError) {
    return <FamilyKeyError reason={keyError} />
  }

  // Show the unlock screen while Firebase auth initialises OR while the
  // encryption key is being fetched for an authenticated session. The
  // key-loading gate prevents any protected page from rendering with a null
  // encryptionKey, which would display raw ciphertext or silently skip
  // decryption.
  if (loading || (isAuthenticated && familyId && keyLoading)) {
    return <UnlockScreen />
  }

  // A link to a page inside the app — a memory someone shared — goes to the
  // login page, which comes back here afterwards. It used to go to the landing
  // page, and signing in from there ended on /home. /home itself still goes
  // to "/": signing in leads there anyway, and it is where a stranger and a
  // visitor who just left the demo land. So does any address ?next= would
  // refuse, the login page's own among them, which would otherwise redirect
  // to itself without end wherever this is rendered on it.
  if (!isAuthenticated) {
    const { pathname, search } = location
    const comeBack = pathname !== '/' && pathname !== '/home' && safeNextPath(pathname + search)
    return <Navigate to={comeBack ? loginPathFor(location) : '/'} replace />
  }

  // An account no family lists: a signup that stopped before the address was
  // confirmed, or an admin another admin removed. /signup finishes it. A
  // viewer always has a family — their token names it.
  if (!familyId && !isViewer) {
    return <Navigate to="/signup" replace />
  }

  // Home, rather than the landing page: a viewer is signed in and belongs here,
  // just not on this page.
  if (adminOnly && !isAdmin) {
    return <Navigate to="/home" replace />
  }

  return children
}
