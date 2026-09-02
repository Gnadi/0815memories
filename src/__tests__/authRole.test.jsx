/**
 * Where privilege comes from.
 *
 * `isAdmin` used to be `!!user`, which was exactly right for as long as a
 * viewer had no Firebase session — they logged in by comparing a password in
 * the browser and setting a flag in localStorage.
 *
 * Viewers now sign in with a custom token, so they have a `user` object too.
 * Left alone, that one expression would have promoted every viewer in every
 * family to administrator and waved them through ProtectedRoute's adminOnly
 * gate. Privilege has to come from the token's role claim, which only the
 * server can write.
 *
 * These tests exist so that line can never quietly go back to what it was.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const authStateHandlers = []
let currentUser = null

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    authStateHandlers.push(cb)
    cb(currentUser)
    return () => {}
  },
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithCustomToken: vi.fn(),
  updateProfile: vi.fn(),
  signOut: vi.fn(),
  setPersistence: vi.fn(() => Promise.resolve()),
  browserLocalPersistence: 'local',
  browserSessionPersistence: 'session',
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  addDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ empty: true, docs: [] })),
  serverTimestamp: vi.fn(),
  updateDoc: vi.fn(),
  // No family document in these tests: the key loader is not what is under test.
  onSnapshot: vi.fn(() => () => {}),
}))

vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn() }))

vi.mock('../config/firebase', () => ({
  auth: { name: 'test-auth' },
  db: { name: 'test-db' },
  functions: { name: 'test-functions' },
}))

vi.mock('../utils/encryption', () => ({
  generateEncryptionKey: vi.fn(),
  importEncryptionKey: vi.fn(),
  clearDecryptedTextCache: vi.fn(),
}))
vi.mock('../components/media/useDecryptedMedia', () => ({ clearDecryptedMediaCache: vi.fn() }))
vi.mock('../utils/decryptPool', () => ({ terminateDecryptPool: vi.fn() }))

const { AuthProvider, useAuth } = await import('../context/AuthContext')

/** A signed-in user whose ID token carries the given claims. */
const userWithClaims = (claims) => ({
  uid: claims.role === 'viewer' ? 'viewer:family-1' : 'uid-admin',
  getIdTokenResult: vi.fn(() => Promise.resolve({ claims })),
})

function Probe() {
  const { isAdmin, isViewer, isAuthenticated, familyId } = useAuth()
  return (
    <ul>
      <li>isAdmin:{String(isAdmin)}</li>
      <li>isViewer:{String(isViewer)}</li>
      <li>isAuthenticated:{String(isAuthenticated)}</li>
      <li>familyId:{String(familyId)}</li>
    </ul>
  )
}

const renderWith = (user) => {
  currentUser = user
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
}

const flag = (name, value) => screen.findByText(`${name}:${value}`)

describe('role derivation', () => {
  beforeEach(() => {
    authStateHandlers.length = 0
    currentUser = null
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('does not make an administrator out of a viewer', async () => {
    renderWith(userWithClaims({ role: 'viewer', familyId: 'family-1' }))

    // The regression this whole file exists for.
    expect(await flag('isAdmin', 'false')).toBeInTheDocument()
    expect(await flag('isViewer', 'true')).toBeInTheDocument()
    expect(await flag('isAuthenticated', 'true')).toBeInTheDocument()
  })

  it('takes the family from the viewer token, not from storage', async () => {
    window.localStorage.setItem('fh_familyId', 'family-somebody-else')
    renderWith(userWithClaims({ role: 'viewer', familyId: 'family-1' }))

    expect(await flag('familyId', 'family-1')).toBeInTheDocument()
  })

  it('recognises an admin by their claim', async () => {
    renderWith(userWithClaims({ role: 'admin', familyId: 'family-1' }))

    expect(await flag('isAdmin', 'true')).toBeInTheDocument()
    expect(await flag('isViewer', 'false')).toBeInTheDocument()
    expect(await flag('familyId', 'family-1')).toBeInTheDocument()
  })

  it('still recognises an admin whose claim has not been written yet', async () => {
    // Signed up before the claim migration, or in the seconds before the sync
    // trigger fires. firestore.rules keeps the adminUids path open for exactly
    // this case, so the client must not lock them out either.
    renderWith(userWithClaims({}))

    expect(await flag('isAdmin', 'true')).toBeInTheDocument()
    expect(await flag('isViewer', 'false')).toBeInTheDocument()
  })

  it('grants nothing when the token cannot be read', async () => {
    // Unknown role must not resolve to admin — that is the direction that hands
    // a viewer the admin UI on a transient network error.
    renderWith({
      uid: 'uid-unknown',
      getIdTokenResult: vi.fn(() => Promise.reject(new Error('network'))),
    })

    expect(await flag('isAdmin', 'false')).toBeInTheDocument()
    expect(await flag('isViewer', 'false')).toBeInTheDocument()
  })

  it('grants nothing without a session', async () => {
    renderWith(null)

    await waitFor(async () => {
      expect(await flag('isAuthenticated', 'false')).toBeInTheDocument()
    })
    expect(await flag('isAdmin', 'false')).toBeInTheDocument()
    expect(await flag('isViewer', 'false')).toBeInTheDocument()
  })
})
