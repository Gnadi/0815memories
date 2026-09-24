// @vitest-environment node
/**
 * api/cloudinary-sign — the endpoint that lets a browser write to the
 * Cloudinary account. It used to sign for any caller at all; it now signs only
 * for a verified Firebase ID token carrying the admin role.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const verifyIdToken = vi.fn()
vi.mock('firebase-admin/app', () => ({
  getApps: () => [],
  initializeApp: vi.fn(() => ({})),
}))
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken }),
}))

import handler from '../../api/cloudinary-sign.js'

function call({ authorization, query = {} } = {}) {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value },
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
  const req = { headers: authorization ? { authorization } : {}, query }
  return handler(req, res).then(() => res)
}

// `globalThis.process` rather than the bare global: eslint gives files under
// src/ browser globals only.
const env = globalThis.process.env

const ENV = {
  CLOUDINARY_API_SECRET: 'secret',
  CLOUDINARY_API_KEY: 'key',
  VITE_FIREBASE_PROJECT_ID: 'demo-project',
}

beforeEach(() => {
  verifyIdToken.mockReset()
  for (const [k, v] of Object.entries(ENV)) env[k] = v
})

afterEach(() => {
  for (const k of Object.keys(ENV)) delete env[k]
})

describe('api/cloudinary-sign', () => {
  it('refuses a caller with no token', async () => {
    const res = await call()
    expect(res.statusCode).toBe(401)
    expect(res.body.signature).toBeUndefined()
    expect(verifyIdToken).not.toHaveBeenCalled()
  })

  it('refuses a token that does not verify', async () => {
    verifyIdToken.mockRejectedValue(new Error('bad signature'))
    const res = await call({ authorization: 'Bearer forged' })
    expect(res.statusCode).toBe(401)
    expect(res.body.signature).toBeUndefined()
  })

  it('refuses a viewer', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'viewer:fam', role: 'viewer', familyId: 'fam' })
    const res = await call({ authorization: 'Bearer t' })
    expect(res.statusCode).toBe(403)
    expect(res.body.signature).toBeUndefined()
  })

  it('refuses an account that belongs to no family', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'stranger' })
    const res = await call({ authorization: 'Bearer t' })
    expect(res.statusCode).toBe(403)
  })

  it('signs for a family admin', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'admin', role: 'admin', familyId: 'fam' })
    const res = await call({ authorization: 'Bearer good', query: { resource_type: 'raw' } })
    expect(verifyIdToken).toHaveBeenCalledWith('good')
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ folder: 'kaydo/encrypted', apiKey: 'key', resourceType: 'raw' })
    expect(res.body.signature).toMatch(/^[0-9a-f]{40}$/)
    expect(res.headers['Cache-Control']).toBe('no-store')
  })

  it('fails closed when it cannot verify tokens at all', async () => {
    delete env.VITE_FIREBASE_PROJECT_ID
    verifyIdToken.mockResolvedValue({ uid: 'admin', role: 'admin' })
    const res = await call({ authorization: 'Bearer good' })
    expect(res.statusCode).toBe(500)
    expect(res.body.signature).toBeUndefined()
  })
})
