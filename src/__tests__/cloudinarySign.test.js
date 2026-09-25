// @vitest-environment node
/**
 * api/cloudinary-sign — the endpoint that lets a browser write to the
 * Cloudinary account. It used to sign for any caller at all; it now signs only
 * for a verified Firebase ID token of a family admin — by the role claim, or,
 * for an admin from before the claims, by the family document, asked of
 * Firestore as the caller.
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

// Firestore's REST answer to runQuery: one row per document, or a single row
// with only a readTime when nothing matched.
const found = () => ({ ok: true, json: async () => [{ document: { name: 'projects/p/databases/(default)/documents/families/fam' } }] })
const none = () => ({ ok: true, json: async () => [{ readTime: '2026-09-24T00:00:00Z' }] })
let firestore

beforeEach(() => {
  verifyIdToken.mockReset()
  for (const [k, v] of Object.entries(ENV)) env[k] = v
  firestore = vi.fn(async () => none())
  globalThis.fetch = firestore
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

  describe('an admin without a role claim', () => {
    // Admins from before the claims carry none; the rules accept them by the
    // family document, and refusing them here broke their photo uploads.
    it('is signed for when the family document lists them', async () => {
      verifyIdToken.mockResolvedValue({ uid: 'legacy' })
      firestore.mockResolvedValueOnce(found())
      const res = await call({ authorization: 'Bearer t', query: { resource_type: 'raw' } })
      expect(res.statusCode).toBe(200)
      expect(res.body.signature).toMatch(/^[0-9a-f]{40}$/)

      // Asked as the caller, so Firestore's own rules decide, and only for
      // document names: the family document also holds the encryption key.
      const [url, init] = firestore.mock.calls[0]
      expect(url).toBe('https://firestore.googleapis.com/v1/projects/demo-project/databases/(default)/documents:runQuery')
      expect(init.headers.Authorization).toBe('Bearer t')
      const { structuredQuery } = JSON.parse(init.body)
      expect(structuredQuery.where.fieldFilter).toEqual({
        field: { fieldPath: 'adminUids' }, op: 'ARRAY_CONTAINS', value: { stringValue: 'legacy' },
      })
      expect(structuredQuery.select.fields).toEqual([{ fieldPath: '__name__' }])
    })

    it('is found by the owner field on the oldest families', async () => {
      verifyIdToken.mockResolvedValue({ uid: 'owner' })
      firestore.mockResolvedValueOnce(none()).mockResolvedValueOnce(found())
      const res = await call({ authorization: 'Bearer t' })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(firestore.mock.calls[1][1].body).structuredQuery.where.fieldFilter.field.fieldPath).toBe('adminUid')
    })

    it('is refused when no family document lists them', async () => {
      verifyIdToken.mockResolvedValue({ uid: 'stranger' })
      const res = await call({ authorization: 'Bearer t' })
      expect(res.statusCode).toBe(403)
      expect(firestore).toHaveBeenCalledTimes(2)
    })

    it('is refused when Firestore cannot be asked, rather than let through', async () => {
      verifyIdToken.mockResolvedValue({ uid: 'legacy' })
      firestore.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      const res = await call({ authorization: 'Bearer t' })
      expect(res.statusCode).toBe(403)
      expect(res.body.signature).toBeUndefined()
    })
  })

  it('never asks Firestore about a viewer or an admin with the claim', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'viewer:fam', role: 'viewer', familyId: 'fam' })
    await call({ authorization: 'Bearer t' })
    verifyIdToken.mockResolvedValue({ uid: 'admin', role: 'admin', familyId: 'fam' })
    await call({ authorization: 'Bearer t' })
    expect(firestore).not.toHaveBeenCalled()
  })

  it('fails closed when it cannot verify tokens at all', async () => {
    delete env.VITE_FIREBASE_PROJECT_ID
    verifyIdToken.mockResolvedValue({ uid: 'admin', role: 'admin' })
    const res = await call({ authorization: 'Bearer good' })
    expect(res.statusCode).toBe(500)
    expect(res.body.signature).toBeUndefined()
  })
})
