/**
 * Which family an admin of several is bound to at sign-in.
 *
 * loginAsAdmin looks the admin up by adminUids and used to take whichever
 * family Firestore listed first — which need not be the family their token's
 * claim names, and so not the one onAuthStateChanged had just set. The claim's
 * family now wins, then the family they own.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'

const signIn = vi.fn()
const getDocs = vi.fn()

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    cb(null)
    return () => {}
  },
  signInWithEmailAndPassword: (...args) => signIn(...args),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithCustomToken: vi.fn(),
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
  getDocs: (...args) => getDocs(...args),
  serverTimestamp: vi.fn(),
  updateDoc: vi.fn(),
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

let auth
function Capture() {
  auth = useAuth()
  return null
}

const UID = 'uid-admin'
const family = (id, adminUid) => ({ id, data: () => ({ adminUid, adminUids: [adminUid, UID] }) })

/** Firestore lists another's family first, then the one this admin owns, then a third. */
const LISTED = { empty: false, docs: [family('fam-a', 'uid-other'), family('fam-owned', UID), family('fam-c', 'uid-third')] }

function signInWithClaims(claims) {
  signIn.mockResolvedValue({ user: { uid: UID, getIdTokenResult: async () => ({ claims }) } })
}

describe('admin family choice', () => {
  beforeEach(() => {
    signIn.mockReset()
    getDocs.mockReset()
    getDocs.mockResolvedValue(LISTED)
    window.localStorage.clear()
    window.sessionStorage.clear()
    render(
      <AuthProvider>
        <Capture />
      </AuthProvider>,
    )
  })

  it('binds to the family the token names', async () => {
    signInWithClaims({ role: 'admin', familyId: 'fam-c' })
    await act(() => auth.loginAsAdmin('a@example.com', 'pw'))
    expect(auth.familyId).toBe('fam-c')
  })

  it('falls back to the family they own when the token names none', async () => {
    signInWithClaims({})
    await act(() => auth.loginAsAdmin('a@example.com', 'pw'))
    expect(auth.familyId).toBe('fam-owned')
  })

  it('still signs in when the token cannot be read', async () => {
    signIn.mockResolvedValue({
      user: { uid: UID, getIdTokenResult: async () => { throw new Error('network') } },
    })
    await act(() => auth.loginAsAdmin('a@example.com', 'pw'))
    expect(auth.familyId).toBe('fam-owned')
  })
})
