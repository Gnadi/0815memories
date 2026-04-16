/**
 * Tests for the Vercel Cron handler: api/anniversary-cron.js
 *
 * We mock firebase-admin/* so no real Firebase connection is needed.
 * The tests focus on:
 *  - Auth header validation (401 on missing/wrong secret)
 *  - HTTP method validation (405 for unsupported methods)
 *  - Correct response when no memories exist (notified: 0)
 *  - Correct response + queue writes when memories exist
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Firebase Admin mocks — must be declared before importing the handler
// ---------------------------------------------------------------------------

const mockAdd = vi.fn().mockResolvedValue({})
const mockGet = vi.fn()
const mockCollection = vi.fn(() => ({
  where: vi.fn().mockReturnThis(),
  add: mockAdd,
  get: mockGet,
}))
const mockGetFirestore = vi.fn(() => ({ collection: mockCollection }))
const mockInitializeApp = vi.fn()
const mockCert = vi.fn((sa) => sa)
const mockGetApps = vi.fn(() => []) // default: no apps initialised yet

vi.mock('firebase-admin/app', () => ({
  initializeApp: mockInitializeApp,
  cert: mockCert,
  getApps: mockGetApps,
}))

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: mockGetFirestore,
  Timestamp: { fromDate: (d) => d },
  FieldValue: { serverTimestamp: () => '__serverTimestamp__' },
}))

// ---------------------------------------------------------------------------
// Helper to build fake Firestore snapshot docs
// ---------------------------------------------------------------------------

function makeDoc(familyId) {
  return { data: () => ({ familyId }) }
}

function makeSnapshot(docs) {
  return { empty: docs.length === 0, docs }
}

// ---------------------------------------------------------------------------
// Helper to build minimal req/res objects
// ---------------------------------------------------------------------------

function makeReq({ method = 'GET', authorization = undefined } = {}) {
  return {
    method,
    headers: authorization ? { authorization } : {},
  }
}

function makeRes() {
  const res = {
    _status: null,
    _body: null,
    _ended: false,
    status(code) { this._status = code; return this },
    json(body) { this._body = body; return this },
    end(msg) { this._ended = true; this._endMsg = msg; return this },
  }
  return res
}

// ---------------------------------------------------------------------------
// Import handler AFTER mocks are set up
// ---------------------------------------------------------------------------

const { default: handler } = await import('../../api/anniversary-cron.js')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('anniversary-cron handler', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Re-apply defaults after reset
    mockGetApps.mockReturnValue([])
    mockGetFirestore.mockReturnValue({ collection: mockCollection })
    mockCollection.mockReturnValue({
      where: vi.fn().mockReturnThis(),
      add: mockAdd,
      get: mockGet,
    })
    mockAdd.mockResolvedValue({})
    delete process.env.CRON_SECRET
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  })

  describe('auth validation', () => {
    it('returns 401 when CRON_SECRET is set but Authorization header is missing', async () => {
      process.env.CRON_SECRET = 'secret123'
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{}'
      const res = makeRes()
      await handler(makeReq({ authorization: undefined }), res)
      expect(res._status).toBe(401)
    })

    it('returns 401 when Authorization header has wrong secret', async () => {
      process.env.CRON_SECRET = 'secret123'
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{}'
      const res = makeRes()
      await handler(makeReq({ authorization: 'Bearer wrong' }), res)
      expect(res._status).toBe(401)
    })

    it('proceeds when correct Bearer token is provided', async () => {
      process.env.CRON_SECRET = 'secret123'
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{}'
      mockGet.mockResolvedValue(makeSnapshot([]))
      const res = makeRes()
      await handler(makeReq({ authorization: 'Bearer secret123' }), res)
      expect(res._status).toBe(200)
    })

    it('proceeds without auth check when CRON_SECRET env var is not set', async () => {
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{}'
      mockGet.mockResolvedValue(makeSnapshot([]))
      const res = makeRes()
      await handler(makeReq(), res)
      expect(res._status).toBe(200)
    })
  })

  describe('HTTP method validation', () => {
    it('returns 405 for DELETE requests', async () => {
      const res = makeRes()
      await handler(makeReq({ method: 'DELETE' }), res)
      expect(res._status).toBe(405)
    })

    it('returns 405 for PUT requests', async () => {
      const res = makeRes()
      await handler(makeReq({ method: 'PUT' }), res)
      expect(res._status).toBe(405)
    })

    it('accepts POST requests', async () => {
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{}'
      mockGet.mockResolvedValue(makeSnapshot([]))
      const res = makeRes()
      await handler(makeReq({ method: 'POST' }), res)
      expect(res._status).toBe(200)
    })
  })

  describe('notification logic', () => {
    beforeEach(() => {
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'test' })
    })

    it('returns { notified: 0 } when no memories exist for 3 years ago', async () => {
      mockGet.mockResolvedValue(makeSnapshot([]))
      const res = makeRes()
      await handler(makeReq(), res)
      expect(res._status).toBe(200)
      expect(res._body).toEqual({ notified: 0 })
      expect(mockAdd).not.toHaveBeenCalled()
    })

    it('writes one queue entry and returns { notified: 1 } for a single family', async () => {
      mockGet.mockResolvedValue(makeSnapshot([makeDoc('family-A')]))
      const res = makeRes()
      await handler(makeReq(), res)
      expect(res._status).toBe(200)
      expect(res._body).toEqual({ notified: 1 })
      expect(mockAdd).toHaveBeenCalledTimes(1)
      const payload = mockAdd.mock.calls[0][0]
      expect(payload.familyId).toBe('family-A')
      expect(payload.url).toBe('/timeline?filter=onthisday')
      expect(payload.title).toContain('3 Jahre')
    })

    it('writes separate queue entries for two different families', async () => {
      mockGet.mockResolvedValue(makeSnapshot([makeDoc('family-A'), makeDoc('family-B')]))
      const res = makeRes()
      await handler(makeReq(), res)
      expect(res._body).toEqual({ notified: 2 })
      expect(mockAdd).toHaveBeenCalledTimes(2)
    })

    it('pluralises correctly for multiple memories in one family', async () => {
      mockGet.mockResolvedValue(makeSnapshot([makeDoc('family-A'), makeDoc('family-A'), makeDoc('family-A')]))
      const res = makeRes()
      await handler(makeReq(), res)
      const payload = mockAdd.mock.calls[0][0]
      expect(payload.body).toContain('3 Erinnerungen')
    })

    it('uses singular form for exactly one memory', async () => {
      mockGet.mockResolvedValue(makeSnapshot([makeDoc('family-A')]))
      const res = makeRes()
      await handler(makeReq(), res)
      const payload = mockAdd.mock.calls[0][0]
      expect(payload.body).toContain('1 Erinnerung')
      expect(payload.body).not.toContain('Erinnerungen')
    })

    it('does not initialise Firebase again when an app is already running', async () => {
      mockGetApps.mockReturnValue([{ name: '[DEFAULT]' }]) // already initialised
      mockGet.mockResolvedValue(makeSnapshot([]))
      const res = makeRes()
      await handler(makeReq(), res)
      expect(mockInitializeApp).not.toHaveBeenCalled()
    })
  })
})
