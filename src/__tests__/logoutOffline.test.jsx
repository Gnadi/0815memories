/* A logout on a device without a connection. Removing the device's push
   registration is a Firestore delete, and offline that promise waits for the
   server. The logout used to wait with it, and the session, the family key and
   the decrypted caches stayed on a device somebody was about to hand on. */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

let authHandler = null
const signOut = vi.fn(() => Promise.resolve())
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    authHandler = cb
    return () => {}
  },
  signInWithEmailAndPassword: vi.fn(),
  signInWithCustomToken: vi.fn(),
  signOut: (...a) => signOut(...a),
  setPersistence: vi.fn(() => Promise.resolve()),
  browserLocalPersistence: 'local',
  browserSessionPersistence: 'session',
  sendPasswordResetEmail: vi.fn(),
  sendEmailVerification: vi.fn(),
  EmailAuthProvider: { credential: vi.fn() },
  reauthenticateWithCredential: vi.fn(),
}))
vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn() }))
vi.mock('../config/firebase', () => ({
  auth: { name: 'test-auth' },
  db: { name: 'test-db' },
  functions: { name: 'test-functions' },
  resetFirestore: vi.fn(() => Promise.resolve()),
}))
vi.mock('../services/family', () => ({
  findAdminFamilies: vi.fn(async () => []),
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
vi.mock('../components/media/useDecryptedMedia', () => ({ clearDecryptedMediaCache: vi.fn() }))
vi.mock('../utils/decryptPool', () => ({ terminateDecryptPool: vi.fn() }))
// Offline: the delete is queued, and its promise does not settle.
const removeFCMToken = vi.fn(() => new Promise(() => {}))
vi.mock('../utils/notifications', () => ({ removeFCMToken: (...a) => removeFCMToken(...a) }))

const { AuthProvider } = await import('../context/AuthProviderImpl')
const { useAuth } = await import('../context/AuthContext')

const userA = {
  uid: 'uid-a',
  getIdTokenResult: vi.fn(async () => ({ claims: { role: 'admin', familyId: 'fam-a' } })),
}

function Probe() {
  const { encryptionKey, logout } = useAuth()
  return (
    <div>
      <p>key:{encryptionKey ? encryptionKey.imported : 'none'}</p>
      <button type="button" onClick={() => logout()}>Sign out</button>
    </div>
  )
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  authHandler = null
  window.localStorage.clear()
  signOut.mockClear()
  clearDecryptedTextCache.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('a logout without a connection', () => {
  it('signs out and clears the key, without waiting for the push registration', async () => {
    render(<MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>)
    await act(async () => { await authHandler(userA) })
    expect(await screen.findByText('key:family-a-key')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(removeFCMToken).toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })

    expect(signOut).toHaveBeenCalled()
    expect(clearDecryptedTextCache).toHaveBeenCalled()
    expect(screen.getByText('key:none')).toBeInTheDocument()
    expect(window.localStorage.getItem('fh_familyId')).toBeNull()
  })
})
