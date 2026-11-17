/* Another tab can sign this one out, or in as somebody else: Firebase shares
   the session between the tabs of an origin. The provider then has to end the
   session it held, the same way the logout does, or the next person inherits
   the family, the key and the decrypted media of the last. */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

let authHandler = null
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    authHandler = cb
    return () => {}
  },
  signInWithEmailAndPassword: vi.fn(),
  signInWithCustomToken: vi.fn(),
  signOut: vi.fn(() => Promise.resolve()),
  setPersistence: vi.fn(() => Promise.resolve()),
  browserLocalPersistence: 'local',
  browserSessionPersistence: 'session',
  sendPasswordResetEmail: vi.fn(),
  sendEmailVerification: vi.fn(),
  EmailAuthProvider: { credential: vi.fn() },
  reauthenticateWithCredential: vi.fn(),
}))
vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn() }))

const resetFirestore = vi.fn(() => Promise.resolve())
vi.mock('../config/firebase', () => ({
  auth: { name: 'test-auth' },
  db: { name: 'test-db' },
  functions: { name: 'test-functions' },
  resetFirestore: (...a) => resetFirestore(...a),
}))

const findAdminFamilies = vi.fn()
vi.mock('../services/family', () => ({
  findAdminFamilies: (...a) => findAdminFamilies(...a),
  createFamily: vi.fn(),
  isSlugAvailable: vi.fn(),
  subscribeFamily: (_id, onData) => {
    onData({ encryptionKeyJwk: { kty: 'oct', k: 'family-a-key' } })
    return () => {}
  },
}))

const clearDecryptedTextCache = vi.fn()
vi.mock('../utils/encryption', () => ({
  generateEncryptionKey: vi.fn(),
  importEncryptionKey: vi.fn(async (jwk) => ({ imported: jwk.k })),
  clearDecryptedTextCache: (...a) => clearDecryptedTextCache(...a),
}))
const clearDecryptedMediaCache = vi.fn()
vi.mock('../components/media/useDecryptedMedia', () => ({
  clearDecryptedMediaCache: (...a) => clearDecryptedMediaCache(...a),
}))
const terminateDecryptPool = vi.fn()
vi.mock('../utils/decryptPool', () => ({ terminateDecryptPool: (...a) => terminateDecryptPool(...a) }))
vi.mock('../utils/notifications', () => ({ removeFCMToken: vi.fn(() => Promise.resolve()) }))
vi.mock('../components/KaydoLogo', () => ({ default: () => null }))

const { AuthProvider } = await import('../context/AuthProviderImpl')
const { useAuth } = await import('../context/AuthContext')
const { default: ProtectedRoute } = await import('../components/layout/ProtectedRoute')

const userA = {
  uid: 'uid-a',
  getIdTokenResult: vi.fn(async () => ({ claims: { role: 'admin', familyId: 'fam-a' } })),
}
// Signed in, but no claims and a member of no family.
const userB = { uid: 'uid-b', getIdTokenResult: vi.fn(async () => ({ claims: {} })) }

function Probe() {
  const { familyId, encryptionKey, user } = useAuth()
  return (
    <ul>
      <li>user:{user?.uid ?? 'none'}</li>
      <li>familyId:{String(familyId)}</li>
      <li>key:{encryptionKey ? encryptionKey.imported : 'none'}</li>
    </ul>
  )
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/home']}>
      <AuthProvider>
        <Probe />
        <Routes>
          <Route path="/home" element={<ProtectedRoute><div>content of family A</div></ProtectedRoute>} />
          <Route path="/signup" element={<div>signup</div>} />
          <Route path="/" element={<div>landing</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

const emit = (user) => act(async () => { await authHandler(user) })

beforeEach(() => {
  vi.clearAllMocks()
  authHandler = null
  window.localStorage.clear()
  window.sessionStorage.clear()
  findAdminFamilies.mockResolvedValue([])
})

describe('a session that changes without this tab logging out', () => {
  it('leaves nothing of family A to a user without a family', async () => {
    renderApp()
    await emit(userA)
    expect(await screen.findByText('content of family A')).toBeInTheDocument()
    expect(screen.getByText('key:family-a-key')).toBeInTheDocument()
    expect(window.localStorage.getItem('fh_familyId')).toBe('fam-a')

    // The other tab signs out, then somebody else signs in there.
    await emit(null)
    await emit(userB)

    await waitFor(() => expect(screen.getByText('familyId:null')).toBeInTheDocument())
    expect(screen.getByText('key:none')).toBeInTheDocument()
    expect(screen.getByText('user:uid-b')).toBeInTheDocument()
    expect(screen.queryByText('content of family A')).not.toBeInTheDocument()
    expect(window.localStorage.getItem('fh_familyId')).toBeNull()

    // What logout clears, cleared.
    expect(clearDecryptedMediaCache).toHaveBeenCalled()
    expect(clearDecryptedTextCache).toHaveBeenCalled()
    expect(terminateDecryptPool).toHaveBeenCalled()
    expect(resetFirestore).toHaveBeenCalled()
  })

  it('does not hand the stored family of one user to another who signs in at once', async () => {
    renderApp()
    await emit(userA)
    expect(await screen.findByText('content of family A')).toBeInTheDocument()

    // No sign-out event in between: a straight change of uid.
    await emit(userB)

    await waitFor(() => expect(screen.getByText('familyId:null')).toBeInTheDocument())
    expect(screen.getByText('key:none')).toBeInTheDocument()
    expect(screen.queryByText('content of family A')).not.toBeInTheDocument()
  })

  it('clears nothing when the same user is reported again', async () => {
    renderApp()
    await emit(userA)
    expect(await screen.findByText('content of family A')).toBeInTheDocument()
    vi.clearAllMocks()

    await emit({ ...userA })

    expect(screen.getByText('content of family A')).toBeInTheDocument()
    expect(screen.getByText('familyId:fam-a')).toBeInTheDocument()
    expect(screen.getByText('key:family-a-key')).toBeInTheDocument()
    expect(clearDecryptedMediaCache).not.toHaveBeenCalled()
    expect(terminateDecryptPool).not.toHaveBeenCalled()
    expect(resetFirestore).not.toHaveBeenCalled()
    expect(window.localStorage.getItem('fh_familyId')).toBe('fam-a')
  })

  it('keeps the stored family on the first event of a reload with the same user', async () => {
    window.localStorage.setItem('fh_familyId', 'fam-a')
    renderApp()
    await emit(userA)

    expect(await screen.findByText('content of family A')).toBeInTheDocument()
    expect(clearDecryptedMediaCache).not.toHaveBeenCalled()
    expect(resetFirestore).not.toHaveBeenCalled()
    expect(window.localStorage.getItem('fh_familyId')).toBe('fam-a')
  })

  it('still finds the family of an admin whose claim has not landed', async () => {
    findAdminFamilies.mockResolvedValue([{ id: 'fam-x', data: { adminUid: 'uid-b' } }])
    renderApp()
    await emit(userB)

    await waitFor(() => expect(screen.getByText('familyId:fam-x')).toBeInTheDocument())
    expect(window.localStorage.getItem('fh_familyId')).toBe('fam-x')
  })

  it('drops a stored family when the first event reports no one signed in', async () => {
    window.localStorage.setItem('fh_familyId', 'fam-a')
    renderApp()
    await emit(null)

    await waitFor(() => expect(screen.getByText('familyId:null')).toBeInTheDocument())
    expect(window.localStorage.getItem('fh_familyId')).toBeNull()
  })
})
