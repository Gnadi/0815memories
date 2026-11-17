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

import { fetchUploadSignature, signedUploadForm, signedUploadUrl, UPLOAD_QUOTA } from '../utils/uploadSignature'
import { uploadErrorMessage } from '../hooks/useMediaUploader'

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
    callable.mockResolvedValue({ data: { uploads: [SIGNED] } })

    await expect(fetchUploadSignature()).resolves.toEqual(SIGNED)
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'signUpload')
    expect(callable).toHaveBeenCalledWith({ familyId: 'fam-1', kind: 'encrypted', count: 1 })
  })

  it('passes the kind on', async () => {
    callable.mockResolvedValue({ data: { uploads: [SIGNED] } })
    await fetchUploadSignature('public')
    expect(callable).toHaveBeenCalledWith({ familyId: 'fam-1', kind: 'public', count: 1 })
  })

  const signedAs = (n) => ({ ...SIGNED, publicId: `kaydo/fam-1/${n}` })
  const answer = ({ count }, start = 0) =>
    ({ data: { uploads: Array.from({ length: count }, (_, i) => signedAs(start + i)) } })

  it('signs the files asked for together in one call', async () => {
    // One call per file had a choice of photos queue on the same two
    // documents in the signing transaction.
    callable.mockImplementation(async (data) => answer(data))
    const signed = await Promise.all([fetchUploadSignature(), fetchUploadSignature(), fetchUploadSignature()])
    expect(callable).toHaveBeenCalledTimes(1)
    expect(callable).toHaveBeenCalledWith({ familyId: 'fam-1', kind: 'encrypted', count: 3 })
    expect(signed.map((s) => s.publicId)).toEqual(['kaydo/fam-1/0', 'kaydo/fam-1/1', 'kaydo/fam-1/2'])
  })

  it('collects what is asked during a call into the next one', async () => {
    let calls = 0
    callable.mockImplementation(async (data) => answer(data, 10 * calls++))
    const first = fetchUploadSignature()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const later = [fetchUploadSignature(), fetchUploadSignature()]
    await Promise.all([first, ...later])
    expect(callable.mock.calls.map(([data]) => data.count)).toEqual([1, 2])
  })

  it('sends a large choice as several calls', async () => {
    callable.mockImplementation(async (data) => answer(data))
    await Promise.all(Array.from({ length: 25 }, () => fetchUploadSignature()))
    expect(callable.mock.calls.map(([data]) => data.count)).toEqual([20, 5])
  })

  it('asks again for the files a limit left out, and passes the refusal on', async () => {
    callable
      .mockResolvedValueOnce({ data: { uploads: [signedAs(0)] } })
      .mockRejectedValueOnce(Object.assign(new Error('Upload limit reached'), {
        code: 'functions/resource-exhausted',
        details: { reason: 'storage' },
      }))
    const [a, b] = await Promise.allSettled([fetchUploadSignature(), fetchUploadSignature()])
    expect(a.value.publicId).toBe('kaydo/fam-1/0')
    expect(b.reason.code).toBe(UPLOAD_QUOTA)
    expect(b.reason.reason).toBe('storage')
    expect(callable.mock.calls.map(([data]) => data.count)).toEqual([2, 1])
  })

  it('works with a function from before batches, one signature per call', async () => {
    let n = 0
    callable.mockImplementation(async () => ({ data: signedAs(n++) }))
    const signed = await Promise.all([fetchUploadSignature(), fetchUploadSignature()])
    expect(signed.map((s) => s.publicId)).toEqual(['kaydo/fam-1/0', 'kaydo/fam-1/1'])
  })

  it('reports a refusal as a failed signature', async () => {
    callable.mockRejectedValue(Object.assign(new Error('Only family admins can upload'), { code: 'functions/permission-denied' }))
    await expect(fetchUploadSignature()).rejects.toThrow('Failed to get upload signature')
  })

  it.each([
    ['rate', 'rate'],
    ['storage', 'storage'],
    [undefined, 'rate'],
  ])('reports a refused quota (%s) so the person can be told why', async (reason, expected) => {
    callable.mockRejectedValue(Object.assign(new Error('Upload limit reached'), {
      code: 'functions/resource-exhausted',
      details: reason ? { reason } : undefined,
    }))
    const error = await fetchUploadSignature().catch((e) => e)
    expect(error.code).toBe(UPLOAD_QUOTA)
    expect(error.reason).toBe(expected)
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

describe('uploadErrorMessage for a quota', () => {
  const t = (key) => key
  it('says which limit was reached', () => {
    expect(uploadErrorMessage({ code: UPLOAD_QUOTA, reason: 'rate' }, t)).toBe('upload.rateLimited')
    expect(uploadErrorMessage({ code: UPLOAD_QUOTA, reason: 'storage' }, t)).toBe('upload.storageFull')
  })
})
