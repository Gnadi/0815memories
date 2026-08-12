/**
 * Tests for api/send-push.js — the Vercel function that replaced the Cloud
 * Function (and with it, the need for a Firebase Blaze plan).
 *
 * firebase-admin is mocked wholesale: what matters here is the gate in front of
 * the send (is the caller an admin of this family?) and what comes out the other
 * side (generic text, the sender's own device skipped, only genuinely dead
 * tokens pruned).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockVerifyIdToken = vi.fn()
const mockSend = vi.fn()
const mockFamilyGet = vi.fn()
const mockTokensGet = vi.fn()

vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  cert: vi.fn((v) => v),
  getApps: () => [{ name: '[DEFAULT]' }], // pretend the app is already initialised
}))
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken: mockVerifyIdToken }),
}))
vi.mock('firebase-admin/messaging', () => ({
  getMessaging: () => ({ send: mockSend }),
}))
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: (name) => {
      if (name === 'families') return { doc: () => ({ get: mockFamilyGet }) }
      return { where: () => ({ get: mockTokensGet }) }
    },
  }),
}))

const { default: handler } = await import('../../api/send-push.js')

// The suite runs in jsdom, where `process` is not a browser global — same
// access pattern the emulator rule tests use.
const env = globalThis.process.env

const ADMIN = 'uid-admin'
const FAMILY = 'family-1'

// Minimal stand-in for the Vercel response object.
function mockRes() {
  const res = {
    statusCode: null,
    payload: null,
    status(code) {
      res.statusCode = code
      return res
    },
    json(payload) {
      res.payload = payload
      return res
    },
  }
  return res
}

const post = (body) => ({ method: 'POST', body })

// A token document as the client now writes it: token as the document id.
function tokenDoc(token, lang = 'de') {
  return { data: () => ({ token, lang, familyId: FAMILY }), ref: { delete: vi.fn() } }
}

function fcmError(code) {
  return Object.assign(new Error(code), { code })
}

beforeEach(() => {
  vi.clearAllMocks()
  env.FIREBASE_SERVICE_ACCOUNT_JSON = '{"project_id":"demo"}'
  mockVerifyIdToken.mockResolvedValue({ uid: ADMIN })
  mockFamilyGet.mockResolvedValue({ data: () => ({ adminUid: ADMIN, adminUids: [ADMIN] }) })
  mockTokensGet.mockResolvedValue({ docs: [tokenDoc('token-b')] })
  mockSend.mockResolvedValue('projects/demo/messages/1')
})

describe('api/send-push — request validation', () => {
  it('rejects anything but POST', async () => {
    const res = mockRes()
    await handler({ method: 'GET', body: {} }, res)
    expect(res.statusCode).toBe(405)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('rejects a request without a familyId', async () => {
    const res = mockRes()
    await handler(post({ idToken: 't', kind: 'memory' }), res)
    expect(res.statusCode).toBe(400)
  })

  it('rejects an unknown kind — the client cannot invent notification types', async () => {
    const res = mockRes()
    await handler(post({ idToken: 't', familyId: FAMILY, kind: 'ransom-note' }), res)
    expect(res.statusCode).toBe(400)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('rejects an anniversary without a usable count', async () => {
    const res = mockRes()
    await handler(
      post({ idToken: 't', familyId: FAMILY, kind: 'anniversary', params: { year: 2023 } }),
      res
    )
    expect(res.statusCode).toBe(400)
  })
})

describe('api/send-push — authorisation', () => {
  it('rejects an invalid or missing ID token', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('invalid token'))
    const res = mockRes()
    await handler(post({ idToken: 'bogus', familyId: FAMILY, kind: 'memory' }), res)
    expect(res.statusCode).toBe(401)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it("rejects a valid user who is not an admin of THIS family", async () => {
    // Family documents are world-readable, so knowing a familyId must not be
    // enough to push into someone else's household.
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-stranger' })
    const res = mockRes()
    await handler(post({ idToken: 't', familyId: FAMILY, kind: 'memory' }), res)
    expect(res.statusCode).toBe(403)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('accepts a family that never migrated to adminUids', async () => {
    mockFamilyGet.mockResolvedValue({ data: () => ({ adminUid: ADMIN }) })
    const res = mockRes()
    await handler(post({ idToken: 't', familyId: FAMILY, kind: 'memory' }), res)
    expect(res.statusCode).toBe(200)
  })

  it('fails clearly when the service account is not configured', async () => {
    // getApps() is mocked as already-initialised, so exercise the raw guard.
    const original = env.FIREBASE_SERVICE_ACCOUNT_JSON
    delete env.FIREBASE_SERVICE_ACCOUNT_JSON
    vi.resetModules()
    vi.doMock('firebase-admin/app', () => ({
      initializeApp: vi.fn(),
      cert: vi.fn((v) => v),
      getApps: () => [],
    }))
    const { default: freshHandler } = await import('../../api/send-push.js')
    const res = mockRes()
    await freshHandler(post({ idToken: 't', familyId: FAMILY, kind: 'memory' }), res)
    expect(res.statusCode).toBe(500)
    expect(res.payload.error).toContain('FIREBASE_SERVICE_ACCOUNT_JSON')
    env.FIREBASE_SERVICE_ACCOUNT_JSON = original
    vi.doUnmock('firebase-admin/app')
    vi.resetModules()
  })
})

describe('api/send-push — sending', () => {
  it('sends a data-only message so the service worker renders it', async () => {
    const res = mockRes()
    await handler(
      post({ idToken: 't', familyId: FAMILY, kind: 'memory', params: { memoryId: 'mem1' } }),
      res
    )
    expect(res.statusCode).toBe(200)
    expect(res.payload).toEqual({ sent: 1, failed: 0 })

    const msg = mockSend.mock.calls[0][0]
    expect(msg.token).toBe('token-b')
    expect(msg.notification).toBeUndefined()
    expect(msg.data.url).toBe('/memory/mem1')
    expect(msg.data.title).toBeTruthy()
  })

  it('never puts client-supplied text into the payload', async () => {
    const res = mockRes()
    await handler(
      post({
        idToken: 't',
        familyId: FAMILY,
        kind: 'memory',
        params: { memoryId: 'mem1', title: 'Sommerurlaub 2024' },
      }),
      res
    )
    const { data } = mockSend.mock.calls[0][0]
    expect(JSON.stringify(data)).not.toContain('Sommerurlaub')
  })

  it("uses each recipient's own language", async () => {
    mockTokensGet.mockResolvedValue({ docs: [tokenDoc('token-de', 'de'), tokenDoc('token-en', 'en')] })
    const res = mockRes()
    await handler(post({ idToken: 't', familyId: FAMILY, kind: 'memory' }), res)
    expect(res.payload.sent).toBe(2)
    const titles = mockSend.mock.calls.map((c) => c[0].data.title)
    expect(titles).toContain('Neue Erinnerung')
    expect(titles).toContain('New memory')
  })

  it("skips the sender's own device", async () => {
    mockTokensGet.mockResolvedValue({ docs: [tokenDoc('token-a'), tokenDoc('token-b')] })
    const res = mockRes()
    await handler(
      post({ idToken: 't', familyId: FAMILY, kind: 'memory', excludeToken: 'token-a' }),
      res
    )
    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(mockSend.mock.calls[0][0].token).toBe('token-b')
  })

  it('is a no-op when the family has no registered devices', async () => {
    mockTokensGet.mockResolvedValue({ docs: [] })
    const res = mockRes()
    await handler(post({ idToken: 't', familyId: FAMILY, kind: 'memory' }), res)
    expect(res.payload).toEqual({ sent: 0, failed: 0 })
    expect(mockSend).not.toHaveBeenCalled()
  })
})

describe('api/send-push — token pruning', () => {
  it('deletes a token FCM reports as unregistered', async () => {
    const dead = tokenDoc('token-dead')
    mockTokensGet.mockResolvedValue({ docs: [dead] })
    mockSend.mockRejectedValue(fcmError('messaging/registration-token-not-registered'))

    const res = mockRes()
    await handler(post({ idToken: 't', familyId: FAMILY, kind: 'memory' }), res)
    expect(dead.ref.delete).toHaveBeenCalled()
    expect(res.payload).toEqual({ sent: 0, failed: 1 })
  })

  it('keeps tokens when the send fails for a transient reason', async () => {
    // The old Cloud Function deleted on *any* rejection, so a network blip or a
    // malformed payload would have wiped every device in the family.
    const alive = tokenDoc('token-alive')
    mockTokensGet.mockResolvedValue({ docs: [alive] })
    mockSend.mockRejectedValue(fcmError('messaging/server-unavailable'))

    const res = mockRes()
    await handler(post({ idToken: 't', familyId: FAMILY, kind: 'memory' }), res)
    expect(alive.ref.delete).not.toHaveBeenCalled()
    expect(res.payload).toEqual({ sent: 0, failed: 1 })
  })
})
