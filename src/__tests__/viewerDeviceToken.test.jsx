/**
 * The viewer device token, client side.
 *
 * viewerLogin hands a device a token on its first successful login; sending it
 * back on later logins is what keeps a family-wide lockout — triggered by
 * someone else's wrong guesses — from locking this device out too. It has to
 * outlive logout to be any use.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'

const callable = vi.fn()

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    cb(null)
    return () => {}
  },
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithCustomToken: vi.fn(async () => {}),
  updateProfile: vi.fn(),
  signOut: vi.fn(async () => {}),
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
  onSnapshot: vi.fn(() => () => {}),
}))

vi.mock('firebase/functions', () => ({ httpsCallable: () => callable }))

const resetFirestore = vi.fn(async () => {})
vi.mock('../config/firebase', () => ({
  auth: { name: 'test-auth' },
  db: { name: 'test-db' },
  functions: { name: 'test-functions' },
  resetFirestore: () => resetFirestore(),
}))

vi.mock('../utils/encryption', () => ({
  generateEncryptionKey: vi.fn(),
  importEncryptionKey: vi.fn(),
  clearDecryptedTextCache: vi.fn(),
}))
vi.mock('../components/media/useDecryptedMedia', () => ({ clearDecryptedMediaCache: vi.fn() }))
vi.mock('../utils/decryptPool', () => ({ terminateDecryptPool: vi.fn() }))
vi.mock('../utils/notifications', () => ({ removeFCMToken: vi.fn(async () => {}) }))

const { AuthProvider, useAuth } = await import('../context/AuthContext')

let auth
function Capture() {
  auth = useAuth()
  return null
}

const STORED = 'kaydo_viewer_device:family-1'

describe('viewer device token', () => {
  beforeEach(() => {
    callable.mockReset()
    resetFirestore.mockClear()
    window.localStorage.clear()
    window.sessionStorage.clear()
    render(
      <AuthProvider>
        <Capture />
      </AuthProvider>,
    )
  })

  it('sends none on a first login, and keeps the one it is given', async () => {
    callable.mockResolvedValue({ data: { token: 'custom', deviceToken: 'device-abc' } })
    await act(() => auth.loginAsViewer('pw', 'family-1'))

    expect(callable).toHaveBeenCalledWith({ familyId: 'family-1', password: 'pw', deviceToken: undefined })
    expect(window.localStorage.getItem(STORED)).toBe('device-abc')
  })

  it('sends it back on the next login, and keeps it when none new is minted', async () => {
    window.localStorage.setItem(STORED, 'device-abc')
    callable.mockResolvedValue({ data: { token: 'custom' } })
    await act(() => auth.loginAsViewer('pw', 'family-1'))

    expect(callable).toHaveBeenCalledWith({ familyId: 'family-1', password: 'pw', deviceToken: 'device-abc' })
    expect(window.localStorage.getItem(STORED)).toBe('device-abc')
  })

  it('leaves nothing of the session in the Firestore cache on logout', async () => {
    // Documents outlive their listeners in the LRU cache, the family document
    // and its key among them; logout replaces the instance so none survive.
    callable.mockResolvedValue({ data: { token: 'custom' } })
    await act(() => auth.loginAsViewer('pw', 'family-1'))
    await act(() => auth.logout())
    expect(resetFirestore).toHaveBeenCalledTimes(1)
  })

  it('outlives logout, which is when it is needed next', async () => {
    callable.mockResolvedValue({ data: { token: 'custom', deviceToken: 'device-abc' } })
    await act(() => auth.loginAsViewer('pw', 'family-1', { remember: false }))
    await act(() => auth.logout())

    expect(window.localStorage.getItem(STORED)).toBe('device-abc')
  })
})
