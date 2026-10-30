/* eslint-disable react-refresh/only-export-components --
   This module is the context itself: it exports the context object, the hook
   and the preload function next to the provider, and AuthProviderImpl needs
   the context object from here. */
import { createContext, useContext, useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { useLocation } from 'react-router-dom'
import { hasStoredSession } from '../utils/authStorage'
import { isDemoMode } from '../demo/demoMode'
import { PRERENDERED_PATHS } from '../prerenderedRoutes'

export const AuthContext = createContext(null)

// The real provider (AuthProviderImpl) brings Firebase Auth, Firestore and
// Functions with it — about two thirds of the startup JavaScript — so it is
// loaded only where something needs it. A visitor who opens the landing page
// or a legal page, signed out, never downloads any of it: the page is
// pre-rendered and needs nothing from Firebase to paint, and the claim form
// loads what it needs when it is submitted (context/signupAccount.js).
const loadProvider = () => import('./AuthProviderImpl')
const AuthProviderImpl = lazy(() => loadProvider().then((m) => ({ default: m.AuthProvider })))

// Read once per page load, as in AuthProviderImpl: entering and leaving the
// demo are hard navigations (demo/demoMode.js).
const DEMO = isDemoMode()

// Every path the provider is needed on: the pre-rendered pages are the only
// ones that work without it.
const needsProvider = (pathname) => !PRERENDERED_PATHS.includes(pathname)

/**
 * Starts loading the provider before React asks for it, so that on a login, a
 * deep link or a returning member's launch the download runs alongside the
 * app's own scripts instead of after them. Client only (main.jsx).
 */
export function preloadAuthProvider() {
  if (DEMO || hasStoredSession() || needsProvider(window.location.pathname)) loadProvider()
}

const noFirebase = async () => {
  throw new Error('Firebase has not been loaded on this page')
}

// What a page without the provider sees: nobody is signed in. `firebaseReady`
// only says whether this build has a Firebase project to talk to, for the
// claim form's setup notice.
const SIGNED_OUT = {
  user: null,
  isViewer: false,
  isAdmin: false,
  isAuthenticated: false,
  isDemo: DEMO,
  familyId: null,
  encryptionKey: null,
  memoryCardStyle: null,
  keyLoading: false,
  keyError: null,
  firebaseReady: !!import.meta.env.VITE_FIREBASE_API_KEY,
  loginAsViewer: noFirebase,
  loginAsAdmin: noFirebase,
  sendAdminPasswordReset: noFirebase,
  signup: noFirebase,
  emailVerified: false,
  sendVerificationEmail: noFirebase,
  checkEmailVerified: noFirebase,
  createOwnFamily: noFirebase,
  discardNewAccount: noFirebase,
  logout: noFirebase,
  setActiveFamilyId: () => {},
  stayLoggedIn: true,
  setStayLoggedIn: noFirebase,
}

function PageLoader() {
  return <div className="min-h-screen bg-cream" aria-hidden="true" />
}

/**
 * Hands `children` the signed-out state on a pre-rendered page, and the real
 * provider everywhere else — including on a pre-rendered page when a session
 * is stored, which has to be restored (and, on "/", redirected to /home).
 *
 * Whether a session is stored cannot be read during the first render: the
 * server and the hydrating client must produce the same markup. So that first
 * render says `loading`, as the real provider does while it restores a
 * session, and the effect decides. Moving on to a page that needs the provider
 * swaps it in then; the page being left is a public one, which keeps no state
 * worth carrying over.
 */
export function AuthProvider({ children }) {
  const { pathname } = useLocation()
  // null until storage has been read: this render matches the pre-rendered one.
  const [restoring, setRestoring] = useState(null)

  useEffect(() => {
    // Storage is client-only, which is why this is an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRestoring(hasStoredSession())
  }, [])

  const signedOut = useMemo(() => ({ ...SIGNED_OUT, loading: restoring === null }), [restoring])

  if (DEMO || restoring || needsProvider(pathname)) {
    return (
      <Suspense fallback={<PageLoader />}>
        <AuthProviderImpl>{children}</AuthProviderImpl>
      </Suspense>
    )
  }

  return (
    <AuthContext.Provider value={signedOut}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
