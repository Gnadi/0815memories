/**
 * Tests for src/utils/notifications.js — registering a device for push.
 *
 * This is where push was broken. The previous version looked for an existing
 * token document with a query:
 *
 *     query(collection(db, 'fcmTokens'), where('token', '==', token))
 *
 * and `firestore.rules` denies every read of that collection. The query threw,
 * the write below it never ran, `fcmTokens` stayed empty, and the dispatcher
 * had nothing to send to. The caller swallowed the rejection, so the prompt
 * closed as if it had worked.
 *
 * So the properties under test are: no read, a document id the client can
 * compute on its own, and an error that actually reaches the caller.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockSetDoc = vi.fn()
const mockDeleteDoc = vi.fn()
const mockGetToken = vi.fn()
const mockDeleteToken = vi.fn()

vi.mock('firebase/firestore', () => ({
  doc: (_db, collection, id) => ({ collection, id }),
  setDoc: (...a) => mockSetDoc(...a),
  deleteDoc: (...a) => mockDeleteDoc(...a),
  serverTimestamp: () => '__ts',
  // Deliberately present and deliberately unused: if the implementation ever
  // reaches for a query again, these blow up instead of silently failing in
  // production against the rules.
  collection: () => { throw new Error('fcmTokens must never be queried') },
  query: () => { throw new Error('fcmTokens must never be queried') },
  where: () => { throw new Error('fcmTokens must never be queried') },
  getDocs: () => { throw new Error('fcmTokens must never be queried') },
}))

vi.mock('firebase/messaging', () => ({
  getToken: (...a) => mockGetToken(...a),
  deleteToken: (...a) => mockDeleteToken(...a),
  onMessage: () => () => {},
}))

vi.mock('../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'uid-admin' } },
  getMessagingInstance: () => Promise.resolve({ __messaging: true }),
}))

// The SHA-256 of 'fcm-token-123', which is the document id the client derives.
const TOKEN = 'fcm-token-123'
const TOKEN_ID = '60554ee626032111dd661ff9c2c6b5d6cb8ba8a36c99dbe317a33af475187c71'

let requestAndSaveFCMToken
let removeFCMToken
let isPushSupported

beforeEach(async () => {
  vi.clearAllMocks()
  vi.resetModules()
  vi.stubEnv('VITE_FIREBASE_VAPID_KEY', 'test-vapid-key')

  window.PushManager = function PushManager() {}
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    writable: true,
    value: Object.assign(function Notification() {}, {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    }),
  })
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ __swReg: true }) },
  })

  mockGetToken.mockResolvedValue(TOKEN)
  mockSetDoc.mockResolvedValue(undefined)
  mockDeleteDoc.mockResolvedValue(undefined)
  localStorage.clear()
  ;({ requestAndSaveFCMToken, removeFCMToken, isPushSupported } = await import('../utils/notifications.js'))
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('requestAndSaveFCMToken', () => {
  it('writes the token to a document it addresses by hash', async () => {
    const token = await requestAndSaveFCMToken('family-1')

    expect(token).toBe(TOKEN)
    expect(mockSetDoc).toHaveBeenCalledTimes(1)
    const [ref, data, options] = mockSetDoc.mock.calls[0]
    expect(ref).toEqual({ collection: 'fcmTokens', id: TOKEN_ID })
    expect(data.familyId).toBe('family-1')
    expect(data.token).toBe(TOKEN)
    expect(options).toEqual({ merge: true })
  })

  it('records who is signed in and which language they read', async () => {
    // Both are read by the Cloud Function: `uid` to skip the author's own
    // device, `lang` because the notification text is composed server-side.
    await requestAndSaveFCMToken('family-1')
    const [, data] = mockSetDoc.mock.calls[0]
    expect(data.uid).toBe('uid-admin')
    expect(data.lang).toBe('en')
  })

  it('lets a rejected write reach the caller', async () => {
    mockSetDoc.mockRejectedValue(Object.assign(new Error('denied'), { code: 'permission-denied' }))
    await expect(requestAndSaveFCMToken('family-1')).rejects.toThrow('denied')
  })

  it('does nothing when permission is refused', async () => {
    window.Notification.requestPermission.mockResolvedValue('denied')
    expect(await requestAndSaveFCMToken('family-1')).toBeNull()
    expect(mockSetDoc).not.toHaveBeenCalled()
  })

  it('does not ask again once permission is denied for good', async () => {
    window.Notification.permission = 'denied'
    expect(await requestAndSaveFCMToken('family-1')).toBeNull()
    expect(window.Notification.requestPermission).not.toHaveBeenCalled()
  })
})

describe('removeFCMToken', () => {
  it('deletes the document this device registered', async () => {
    await requestAndSaveFCMToken('family-1')
    await removeFCMToken()

    expect(mockDeleteToken).toHaveBeenCalled()
    expect(mockDeleteDoc).toHaveBeenCalledWith({ collection: 'fcmTokens', id: TOKEN_ID })
  })

  it('is a no-op on a device that never registered', async () => {
    await removeFCMToken()
    expect(mockDeleteDoc).not.toHaveBeenCalled()
  })
})

describe('isPushSupported', () => {
  it('is false on iOS outside an installed PWA', () => {
    // Safari on iOS shows the permission prompt and then fails to subscribe,
    // so the prompt has to stay hidden until the app is on the home screen.
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1.15',
    })
    window.navigator.standalone = false
    window.matchMedia = () => ({ matches: false })
    expect(isPushSupported()).toBe(false)

    window.navigator.standalone = true
    expect(isPushSupported()).toBe(true)
  })
})
