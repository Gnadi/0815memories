import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAuth = vi.hoisted(() => ({ currentUser: null }))
const mockStored = vi.hoisted(() => ({ familyId: 'fam-1' }))
const callable = vi.hoisted(() => vi.fn())
const httpsCallable = vi.hoisted(() => vi.fn(() => callable))

vi.mock('../config/firebase', () => ({ auth: mockAuth, functions: { region: 'europe-west3' } }))
vi.mock('../config/cloudinary', () => ({ CLOUDINARY_CLOUD_NAME: 'demo' }))
vi.mock('../utils/authStorage', () => ({
  readStored: (key) => (key === 'fh_familyId' ? mockStored.familyId : null),
}))
vi.mock('firebase/functions', () => ({ httpsCallable }))

import { fetchUploadSignature, signedUploadForm, signedUploadUrl } from '../utils/uploadSignature'

const SIGNED = {
  apiKey: 'k',
  signature: 'sig',
  resourceType: 'raw',
  publicId: 'kaydo/fam-1/abc',
  params: { overwrite: 'false', public_id: 'kaydo/fam-1/abc', tags: 'family:fam-1', timestamp: 1 },
}

beforeEach(() => {
  mockAuth.currentUser = { uid: 'uid-admin' }
  mockStored.familyId = 'fam-1'
  callable.mockReset()
  httpsCallable.mockClear()
})

describe('fetchUploadSignature', () => {
  it('asks signUpload for one encrypted file of the current family', async () => {
    callable.mockResolvedValue({ data: SIGNED })

    await expect(fetchUploadSignature()).resolves.toEqual(SIGNED)
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'signUpload')
    expect(callable).toHaveBeenCalledWith({ familyId: 'fam-1', kind: 'encrypted' })
  })

  it('passes the kind on', async () => {
    callable.mockResolvedValue({ data: SIGNED })
    await fetchUploadSignature('public')
    expect(callable).toHaveBeenCalledWith({ familyId: 'fam-1', kind: 'public' })
  })

  it('reports a refusal as a failed signature', async () => {
    callable.mockRejectedValue(Object.assign(new Error('Only family admins can upload'), { code: 'functions/permission-denied' }))
    await expect(fetchUploadSignature()).rejects.toThrow('Failed to get upload signature')
  })

  it('asks for nothing without a signed-in user', async () => {
    mockAuth.currentUser = null
    await expect(fetchUploadSignature()).rejects.toThrow('Sign in to upload')
    expect(callable).not.toHaveBeenCalled()
  })

  it('asks for nothing without a family', async () => {
    mockStored.familyId = null
    await expect(fetchUploadSignature()).rejects.toThrow('Sign in to upload')
    expect(callable).not.toHaveBeenCalled()
  })
})

describe('the signed upload', () => {
  it('goes to the resource type that was signed', () => {
    expect(signedUploadUrl(SIGNED)).toBe('https://api.cloudinary.com/v1_1/demo/raw/upload')
    expect(signedUploadUrl({ ...SIGNED, resourceType: 'image' }))
      .toBe('https://api.cloudinary.com/v1_1/demo/image/upload')
  })

  it('sends exactly the signed parameters, the key and the signature', () => {
    const form = signedUploadForm(new Blob(['x']), 'encrypted.dat', SIGNED)
    const fields = Object.fromEntries([...form.entries()].filter(([key]) => key !== 'file'))
    expect(fields).toEqual({
      overwrite: 'false',
      public_id: 'kaydo/fam-1/abc',
      tags: 'family:fam-1',
      timestamp: '1',
      api_key: 'k',
      signature: 'sig',
    })
    expect(form.get('file').name).toBe('encrypted.dat')
  })
})
