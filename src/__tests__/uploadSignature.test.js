import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockAuth = vi.hoisted(() => ({ currentUser: null }))
vi.mock('../config/firebase', () => ({ auth: mockAuth }))

import { fetchUploadSignature } from '../utils/uploadSignature'

const SIGNED = { timestamp: 1, signature: 'sig', folder: 'kaydo/encrypted', apiKey: 'k' }
const reply = (status, body = {}) => ({ ok: status < 400, status, json: async () => body })

beforeEach(() => {
  mockAuth.currentUser = {
    getIdToken: vi.fn(async (force) => (force ? 'fresh-token' : 'cached-token')),
  }
})

afterEach(() => {
  delete globalThis.fetch
})

describe('fetchUploadSignature', () => {
  it('sends the ID token and returns the signature', async () => {
    globalThis.fetch = vi.fn(async () => reply(200, SIGNED))

    await expect(fetchUploadSignature('?resource_type=raw')).resolves.toEqual(SIGNED)
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/cloudinary-sign?resource_type=raw', {
      headers: { Authorization: 'Bearer cached-token' },
    })
  })

  it('refreshes the token once when the admin claim has not reached it yet', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(reply(403))
      .mockResolvedValueOnce(reply(200, SIGNED))

    await expect(fetchUploadSignature()).resolves.toEqual(SIGNED)
    expect(mockAuth.currentUser.getIdToken).toHaveBeenLastCalledWith(true)
    expect(globalThis.fetch).toHaveBeenLastCalledWith('/api/cloudinary-sign', {
      headers: { Authorization: 'Bearer fresh-token' },
    })
  })

  it('gives up after that one retry', async () => {
    globalThis.fetch = vi.fn(async () => reply(403))
    await expect(fetchUploadSignature()).rejects.toThrow('Failed to get upload signature')
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('says which status and reason the endpoint gave', async () => {
    // So the message on a phone can tell a refusal from a crashed function.
    globalThis.fetch = vi.fn(async () => reply(500, { error: 'Upload signing is not configured' }))
    await expect(fetchUploadSignature()).rejects.toMatchObject({
      code: 'upload/signature',
      status: 500,
      reason: 'Upload signing is not configured',
    })
    // A 500 is not the claim-lag case; no second try.
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('asks for nothing without a signed-in user', async () => {
    mockAuth.currentUser = null
    globalThis.fetch = vi.fn()
    await expect(fetchUploadSignature()).rejects.toThrow('Sign in to upload')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
