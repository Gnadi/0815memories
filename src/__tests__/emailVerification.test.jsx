/**
 * An admin account founds a family only once its email address is confirmed.
 *
 * A password reset goes to the address an account was registered with. An
 * admin who signed up with a typo, or with someone else's address, used to
 * hand their family — encryption key included — to whoever reads that
 * mailbox. firestore.rules now refuses a family to an unconfirmed account
 * (authRules.test.js); these tests pin the client side: signup() stops after
 * the account, createOwnFamily() waits for the confirmation and fetches the
 * token that carries it, and an account left without a family is led back to
 * finish instead of being signed out into a dead end.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'

const createUser = vi.fn()
const sendVerification = vi.fn()
const signIn = vi.fn()
const signOutMock = vi.fn(async () => {})
const createFamily = vi.fn()
const findAdminFamilies = vi.fn()
const authInstance = { name: 'test-auth', languageCode: null, currentUser: null }

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    cb(null)
    return () => {}
  },
  signInWithEmailAndPassword: (...args) => signIn(...args),
  createUserWithEmailAndPassword: (...args) => createUser(...args),
  sendEmailVerification: (...args) => sendVerification(...args),
  sendPasswordResetEmail: vi.fn(),
  signInWithCustomToken: vi.fn(),
  updateProfile: vi.fn(async () => {}),
  signOut: (...args) => signOutMock(...args),
  setPersistence: vi.fn(() => Promise.resolve()),
  browserLocalPersistence: 'local',
  browserSessionPersistence: 'session',
}))

vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn() }))

vi.mock('../config/firebase', () => ({
  auth: authInstance,
  db: { name: 'test-db' },
  functions: { name: 'test-functions' },
}))

vi.mock('../services/family', () => ({
  backfillAdminUids: vi.fn(),
  createFamily: (...args) => createFamily(...args),
  findAdminFamilies: (...args) => findAdminFamilies(...args),
  isSlugAvailable: vi.fn(async () => true),
  // The family document, for the key; the new family's key is adopted directly.
  subscribeFamily: vi.fn(() => () => {}),
}))

vi.mock('../utils/encryption', () => ({
  generateEncryptionKey: vi.fn(async () => ({ key: 'the-key', jwk: { kty: 'oct', k: 'x' } })),
  importEncryptionKey: vi.fn(),
  clearDecryptedTextCache: vi.fn(),
}))
vi.mock('../components/media/useDecryptedMedia', () => ({ clearDecryptedMediaCache: vi.fn() }))
vi.mock('../utils/decryptPool', () => ({ terminateDecryptPool: vi.fn() }))

const { AuthProvider } = await import('../context/AuthProviderImpl')
const { useAuth } = await import('../context/AuthContext')

let auth
function Capture() {
  auth = useAuth()
  return null
}

/** A Firebase User whose confirmation Firebase reports as `verified()`. */
function fakeUser({ verified = () => false } = {}) {
  const user = {
    uid: 'uid-new',
    email: 'new@example.com',
    displayName: 'Sam',
    emailVerified: verified(),
    reload: vi.fn(async () => { user.emailVerified = verified() }),
    getIdToken: vi.fn(async () => 'token'),
    getIdTokenResult: vi.fn(async () => ({ claims: {} })),
    delete: vi.fn(async () => {}),
  }
  return user
}

async function mount() {
  await act(async () => {
    render(<AuthProvider><Capture /></AuthProvider>)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  authInstance.currentUser = null
  createFamily.mockResolvedValue('fam-new')
  findAdminFamilies.mockResolvedValue([])
  sendVerification.mockResolvedValue()
})

afterEach(cleanup)

describe('signing up', () => {
  it('creates the account and sends the confirmation mail, but no family', async () => {
    const user = fakeUser()
    createUser.mockImplementation(async () => {
      authInstance.currentUser = user
      return { user }
    })
    await mount()

    await act(() => auth.signup('new@example.com', 'secret123', 'Sam', 'The Millers', 'de'))

    expect(sendVerification).toHaveBeenCalledWith(user)
    expect(authInstance.languageCode).toBe('de')
    expect(createFamily).not.toHaveBeenCalled()
    expect(auth.emailVerified).toBe(false)
    expect(auth.familyId).toBeNull()
  })
})

describe('founding the family', () => {
  it('is refused while the address is unconfirmed, without writing anything', async () => {
    const user = fakeUser({ verified: () => false })
    authInstance.currentUser = user
    await mount()

    await expect(act(() => auth.createOwnFamily('The Millers'))).rejects.toMatchObject({ code: 'email-not-verified' })
    expect(user.reload).toHaveBeenCalled()
    expect(createFamily).not.toHaveBeenCalled()
  })

  it('goes through once confirmed, after fetching the token that says so', async () => {
    let confirmed = false
    const user = fakeUser({ verified: () => confirmed })
    authInstance.currentUser = user
    await mount()

    confirmed = true
    await act(() => auth.createOwnFamily('The Millers'))

    // The rules read email_verified from the token; the one the session held
    // was issued before the confirmation.
    expect(user.getIdToken).toHaveBeenCalledWith(true)
    expect(user.getIdToken.mock.invocationCallOrder[0]).toBeLessThan(createFamily.mock.invocationCallOrder[0])
    expect(createFamily).toHaveBeenCalledWith(expect.objectContaining({ uid: 'uid-new', name: 'The Millers', slug: 'the-millers' }))
    expect(auth.familyId).toBe('fam-new')
    expect(auth.emailVerified).toBe(true)
  })
  it('binds an account that does belong to a family instead of founding another', async () => {
    const user = fakeUser({ verified: () => true })
    authInstance.currentUser = user
    await mount()
    findAdminFamilies.mockResolvedValue([{ id: 'fam-existing', data: { adminUid: 'uid-new', adminUids: ['uid-new'] } }])

    await act(() => auth.createOwnFamily('The Millers'))

    expect(createFamily).not.toHaveBeenCalled()
    expect(auth.familyId).toBe('fam-existing')
  })
})

describe('an account no family lists', () => {
  it('stays signed in after logging in, to finish on /signup', async () => {
    const user = fakeUser()
    signIn.mockResolvedValue({ user })
    await mount()

    await act(() => auth.loginAsAdmin('new@example.com', 'secret123'))

    expect(signOutMock).not.toHaveBeenCalled()
    expect(auth.familyId).toBeNull()
  })
})

