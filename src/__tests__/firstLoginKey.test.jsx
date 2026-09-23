/**
 * What a first login looks like to the media layer.
 *
 * Decryption "worked after a reload but not right after signing in", and both
 * halves of that came from the same place: the encryption key is read from the
 * family document, and the session used to say "no key, and none coming" in
 * situations where a key was very much coming.
 *
 * Two of them:
 *
 *   1. `keyLoading` was a flag an effect switched on. An effect runs after the
 *      commit, so the render that first learned the family id — the one
 *      ProtectedRoute opens on — saw no key and nothing loading. On a first
 *      login nothing is in localStorage yet, so that frame is guaranteed.
 *
 *   2. The family-document listener gave up after a single error. The likely
 *      error is permission-denied while the ID token reaches the Firestore
 *      stream, and Firestore does not retry that stream by itself. Nothing
 *      re-subscribed, so the session held no key until the page was reloaded.
 *
 * In either state every encrypted photo resolved to its raw Cloudinary URL,
 * which is ciphertext in an <img> — see isCiphertextUrl for why that is worse
 * than a broken picture on iOS.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useRef, useLayoutEffect } from 'react'
import { render, act, waitFor } from '@testing-library/react'

let currentUser = null
const authHandlers = []
let snapshotNext = null
let snapshotError = null
let subscribeCount = 0

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    authHandlers.push(cb)
    cb(currentUser)
    return () => {}
  },
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithCustomToken: vi.fn(async () => {
    currentUser = {
      uid: 'viewer:family-1',
      getIdToken: vi.fn(async () => 'tok'),
      getIdTokenResult: vi.fn(async () => ({ claims: { role: 'viewer', familyId: 'family-1' } })),
    }
    for (const cb of authHandlers) cb(currentUser)
  }),
  updateProfile: vi.fn(),
  signOut: vi.fn(),
  setPersistence: vi.fn(async () => {}),
  browserLocalPersistence: 'local',
  browserSessionPersistence: 'session',
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  addDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(async () => ({ empty: true, docs: [] })),
  serverTimestamp: vi.fn(),
  updateDoc: vi.fn(),
  onSnapshot: vi.fn((_ref, next, error) => {
    subscribeCount++
    snapshotNext = next
    snapshotError = error
    return () => {}
  }),
}))

vi.mock('firebase/functions', () => ({
  httpsCallable: () => async () => ({ data: { token: 'custom-token' } }),
}))

vi.mock('../config/firebase', () => ({
  auth: { name: 'auth' },
  db: { name: 'db' },
  functions: { name: 'functions' },
}))

vi.mock('../utils/encryption', () => ({
  generateEncryptionKey: vi.fn(),
  importEncryptionKey: vi.fn(async () => ({ fake: 'key' })),
  clearDecryptedTextCache: vi.fn(),
  decryptBlob: vi.fn(),
}))
vi.mock('../utils/decryptPool', () => ({
  terminateDecryptPool: vi.fn(),
  decryptBlobOffThread: vi.fn(),
}))

const { AuthProvider, useAuth } = await import('../context/AuthContext')
const { default: EncryptedImage } = await import('../components/media/EncryptedImage')

const PHOTO = 'https://res.cloudinary.com/demo/raw/upload/kaydo/encrypted/a.dat'

// Every src the <img> has held, sampled in a layout effect so an intermediate
// commit cannot slip past — in a browser that commit is a real network request.
let renderedSrcs = []

function Probe({ onLogin }) {
  const { familyId, encryptionKey, keyLoading, loginAsViewer } = useAuth()
  onLogin(loginAsViewer)

  const ref = useRef(null)
  // A layout effect, not an assertion on the final DOM: every commit counts,
  // because in a browser each one is a request the element actually makes.
  useLayoutEffect(() => {
    const img = ref.current?.querySelector('img')
    if (img) renderedSrcs.push(img.getAttribute('src'))
  })

  return (
    <div data-key={String(!!encryptionKey)} data-loading={String(keyLoading)} ref={ref}>
      {familyId ? <EncryptedImage src={PHOTO} alt="photo" /> : null}
    </div>
  )
}

beforeEach(() => {
  currentUser = null
  authHandlers.length = 0
  snapshotNext = null
  snapshotError = null
  subscribeCount = 0
  renderedSrcs = []
  vi.useRealTimers()
  window.localStorage.clear()
  window.sessionStorage.clear()
  URL.createObjectURL = vi.fn(() => 'blob:decrypted')
  URL.revokeObjectURL = vi.fn()
  globalThis.fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(32) }))
  globalThis.IntersectionObserver = class {
    constructor(cb) { this.cb = cb }
    observe(node) { this.cb([{ isIntersecting: true, target: node }]) }
    disconnect() {}
    unobserve() {}
  }
})

async function signIn() {
  let login
  const view = render(
    <AuthProvider>
      <Probe onLogin={(fn) => { login = fn }} />
    </AuthProvider>
  )
  await act(async () => {
    await login('shared-password', 'family-1', { remember: true })
  })
  return view
}

describe('first login', () => {
  it('never paints the ciphertext URL between signing in and the key arriving', async () => {
    await signIn()
    expect(renderedSrcs).not.toContain(PHOTO)
  })

  it('reports the key as loading from the very render that learns the family', async () => {
    const { container } = await signIn()
    // The family document has not answered yet, so the gate ProtectedRoute
    // reads must still be closed.
    expect(container.firstChild.getAttribute('data-loading')).toBe('true')
    expect(container.firstChild.getAttribute('data-key')).toBe('false')
  })

  it('opens the gate once the family document answers', async () => {
    const { container } = await signIn()
    await act(async () => {
      snapshotNext({ exists: () => true, data: () => ({ encryptionKeyJwk: { kty: 'oct' } }) })
    })
    await waitFor(() =>
      expect(container.firstChild.getAttribute('data-key')).toBe('true')
    )
    expect(container.firstChild.getAttribute('data-loading')).toBe('false')
    expect(renderedSrcs).not.toContain(PHOTO)
  })

  it('re-subscribes when the family document read is denied, instead of giving up', async () => {
    const { container } = await signIn()
    expect(subscribeCount).toBe(1)

    // The token race: the rules answer on an ID token the Firestore stream does
    // not carry yet.
    await act(async () => {
      snapshotError({ code: 'permission-denied', message: 'Missing or insufficient permissions.' })
    })

    // Still loading — a denied read is not an answer, and saying it is left the
    // session keyless with nothing on the way.
    expect(container.firstChild.getAttribute('data-loading')).toBe('true')

    await waitFor(() => expect(subscribeCount).toBe(2), { timeout: 3000 })
    // And the retry refreshed the token first, which is what changes the answer.
    expect(currentUser.getIdTokenResult).toHaveBeenCalledWith(true)

    await act(async () => {
      snapshotNext({ exists: () => true, data: () => ({ encryptionKeyJwk: { kty: 'oct' } }) })
    })
    await waitFor(() =>
      expect(container.firstChild.getAttribute('data-key')).toBe('true')
    )
    expect(renderedSrcs).not.toContain(PHOTO)
  })

  it('gives up gracefully, and still takes the key if a later auth event gets through', async () => {
    vi.useFakeTimers()
    const { container } = await signIn()

    // Every retry denied. The gate has to open eventually — a permanent
    // spinner is not a better answer than a usable app with no key.
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        snapshotError({ code: 'permission-denied', message: 'denied' })
        await vi.advanceTimersByTimeAsync(20000)
      })
    }
    expect(container.firstChild.getAttribute('data-loading')).toBe('false')
    expect(container.firstChild.getAttribute('data-key')).toBe('false')
    expect(renderedSrcs).not.toContain(PHOTO)

    // Abandoning the read must not be recorded as "this family's key is
    // loaded", or the re-subscribe a later auth event triggers would skip the
    // import and the session would stay keyless for good.
    const before = subscribeCount
    await act(async () => {
      currentUser = { ...currentUser }
      for (const cb of authHandlers) cb(currentUser)
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(subscribeCount).toBeGreaterThan(before)
    // And the gate closes again while that attempt is in flight.
    expect(container.firstChild.getAttribute('data-loading')).toBe('true')

    await act(async () => {
      snapshotNext({ exists: () => true, data: () => ({ encryptionKeyJwk: { kty: 'oct' } }) })
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(container.firstChild.getAttribute('data-key')).toBe('true')
    vi.useRealTimers()
  })

  it('settles a family document that has no key at all, so the app is not stuck', async () => {
    const { container } = await signIn()
    await act(async () => {
      snapshotNext({ exists: () => true, data: () => ({}) })
    })
    await waitFor(() =>
      expect(container.firstChild.getAttribute('data-loading')).toBe('false')
    )
    expect(container.firstChild.getAttribute('data-key')).toBe('false')
    // A family predating encryption is a real end state — but a /raw/upload/
    // URL is ciphertext by construction, so it still never reaches the element.
    expect(renderedSrcs).not.toContain(PHOTO)
  })
})
