// @vitest-environment node
/**
 * api/cloudinary-sign — the endpoint that lets a browser write to the
 * Cloudinary account. It used to sign for any caller at all; it now signs only
 * for a family admin, which it learns by asking Firestore, as the caller, for
 * the families that list them as an admin. Firestore verifies the token and
 * applies the rules; this function only reads the answer.
 *
 * It needs no dependencies for that. It used to verify tokens with
 * firebase-admin, whose current release requires Node 22, so whether uploads
 * worked came down to the Node version of the Vercel project.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

// A Firebase ID token's shape: header.payload.signature, base64url. The
// signature is Firestore's to check; here it only has to be there.
const b64url = (value) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
const token = (uid) => `${b64url({ alg: 'RS256' })}.${b64url({ user_id: uid, sub: uid })}.sig`

// Firestore's REST answer to runQuery: one row per document, or a single row
// with only a readTime when nothing matched.
const found = () => ({ ok: true, status: 200, json: async () => [{ document: { name: 'projects/p/databases/(default)/documents/families/fam' } }] })
const none = () => ({ ok: true, status: 200, json: async () => [{ readTime: '2026-09-25T00:00:00Z' }] })
const refused = (status) => ({ ok: false, status, json: async () => ({ error: { status: 'UNAUTHENTICATED' } }) })

// `globalThis.process` rather than the bare global: eslint gives files under
// src/ browser globals only.
const env = globalThis.process.env

const ENV = {
  CLOUDINARY_API_SECRET: 'secret',
  CLOUDINARY_API_KEY: 'key',
  VITE_FIREBASE_PROJECT_ID: 'demo-project',
}

let firestore

beforeEach(() => {
  for (const [k, v] of Object.entries(ENV)) env[k] = v
  delete env.FIRESTORE_EMULATOR_HOST
  firestore = vi.fn(async () => none())
  globalThis.fetch = firestore
})

afterEach(() => {
  for (const k of Object.keys(ENV)) delete env[k]
})

const queryOf = (n = 0) => JSON.parse(firestore.mock.calls[n][1].body).structuredQuery

describe('api/cloudinary-sign', () => {
  it('refuses a caller with no token, without asking anyone', async () => {
    const res = await call()
    expect(res.statusCode).toBe(401)
    expect(res.body.signature).toBeUndefined()
    expect(firestore).not.toHaveBeenCalled()
  })

  it('refuses something that is not a token at all', async () => {
    const res = await call({ authorization: 'Bearer not-a-token' })
    expect(res.statusCode).toBe(401)
    expect(firestore).not.toHaveBeenCalled()
  })

  it('refuses a token Firestore does not accept — forged, expired, another project', async () => {
    firestore.mockResolvedValueOnce(refused(401))
    const res = await call({ authorization: `Bearer ${token('admin')}` })
    expect(res.statusCode).toBe(401)
    expect(res.body.signature).toBeUndefined()
  })

  it('signs for an admin, as Firestore answers for the caller', async () => {
    firestore.mockResolvedValueOnce(found())
    const bearer = token('admin')
    const res = await call({ authorization: `Bearer ${bearer}`, query: { resource_type: 'raw' } })

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ folder: 'kaydo/encrypted', apiKey: 'key', resourceType: 'raw' })
    expect(res.body.signature).toMatch(/^[0-9a-f]{40}$/)
    expect(res.headers['Cache-Control']).toBe('no-store')

    // Asked as the caller, so Firestore verifies the token and applies the
    // rules; and only for document names — the family document holds the key.
    const [url, init] = firestore.mock.calls[0]
    expect(url).toBe('https://firestore.googleapis.com/v1/projects/demo-project/databases/(default)/documents:runQuery')
    expect(init.headers.Authorization).toBe(`Bearer ${bearer}`)
    expect(queryOf().where.fieldFilter).toEqual({
      field: { fieldPath: 'adminUids' }, op: 'ARRAY_CONTAINS', value: { stringValue: 'admin' },
    })
    expect(queryOf().select.fields).toEqual([{ fieldPath: '__name__' }])
  })

  it('finds the owner of a family from before adminUids', async () => {
    firestore.mockResolvedValueOnce(none()).mockResolvedValueOnce(found())
    const res = await call({ authorization: `Bearer ${token('owner')}` })
    expect(res.statusCode).toBe(200)
    expect(queryOf(1).where.fieldFilter.field.fieldPath).toBe('adminUid')
  })

  it('refuses a viewer, or anyone no family lists as an admin', async () => {
    for (const uid of ['viewer:fam', 'stranger']) {
      firestore.mockClear()
      const res = await call({ authorization: `Bearer ${token(uid)}` })
      expect(res.statusCode).toBe(403)
      expect(res.body.signature).toBeUndefined()
      expect(firestore).toHaveBeenCalledTimes(2)
    }
  })

  it('fails closed when Firestore cannot be asked', async () => {
    for (const answer of [
      () => Promise.reject(new Error('offline')),
      () => Promise.resolve(refused(500)),
      () => Promise.resolve({ ok: true, status: 200, json: async () => 'not a list' }),
    ]) {
      firestore.mockImplementationOnce(answer)
      const res = await call({ authorization: `Bearer ${token('admin')}` })
      expect(res.statusCode).toBe(503)
      expect(res.body.signature).toBeUndefined()
    }
  })

  it('asks the emulator when one is set', async () => {
    env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
    firestore.mockResolvedValueOnce(found())
    await call({ authorization: `Bearer ${token('admin')}` })
    expect(firestore.mock.calls[0][0]).toBe('http://127.0.0.1:8080/v1/projects/demo-project/databases/(default)/documents:runQuery')
  })

  it('fails closed when it is not configured', async () => {
    delete env.VITE_FIREBASE_PROJECT_ID
    const res = await call({ authorization: `Bearer ${token('admin')}` })
    expect(res.statusCode).toBe(500)
    expect(res.body.signature).toBeUndefined()
    expect(firestore).not.toHaveBeenCalled()
  })
})
