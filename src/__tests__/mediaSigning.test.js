// @vitest-environment node
/**
 * Upload signatures — functions/mediaSigning.js.
 *
 * The signature is permission to write to the Cloudinary account. It used to
 * cover only a folder and a timestamp, so one signature allowed any number of
 * uploads of any kind for an hour. Now it names one file, and that file is in
 * the ledger before the browser uploads it.
 */
import { describe, it, expect, vi } from 'vitest'
import { createHash } from 'node:crypto'
import {
  cloudinarySignature,
  signUpload,
  SigningError,
  MEDIA_ASSETS,
} from '../../functions/mediaSigning.js'

const FAMILY = 'fam-1'
const ADMIN = 'uid-admin'
const NOW = Date.parse('2026-10-23T10:00:00Z')

function deps({ family = { adminUids: [ADMIN] } } = {}) {
  const written = []
  return {
    written,
    db: {
      doc: (path) => ({
        get: async () => (path === `families/${FAMILY}` && family
          ? { exists: true, data: () => family }
          : { exists: false, data: () => null }),
      }),
      collection: (name) => ({
        doc: (id) => ({ set: vi.fn(async (data) => { written.push({ name, id, data }) }) }),
      }),
    },
    apiKey: 'api-key',
    secret: 'api-secret',
    now: () => NOW,
    randomId: () => 'abc123',
  }
}

describe('cloudinarySignature', () => {
  it('signs the parameters sorted by name, as Cloudinary documents it', () => {
    expect(cloudinarySignature({ timestamp: 1315060510, public_id: 'sample_image' }, 'abcd'))
      .toBe(createHash('sha1').update('public_id=sample_image&timestamp=1315060510abcd').digest('hex'))
  })
})

describe('signUpload', () => {
  it('names one file in the family, and records it before signing', async () => {
    const d = deps()
    const signed = await signUpload(d, ADMIN, { familyId: FAMILY, kind: 'encrypted' })

    expect(signed.publicId).toBe('kaydo/fam-1/abc123')
    expect(signed.resourceType).toBe('raw')
    expect(signed.apiKey).toBe('api-key')
    expect(signed.params).toEqual({
      overwrite: 'false',
      public_id: 'kaydo/fam-1/abc123',
      tags: 'family:fam-1',
      timestamp: NOW / 1000,
    })
    expect(signed.signature).toBe(cloudinarySignature(signed.params, 'api-secret'))

    expect(d.written).toEqual([{
      name: MEDIA_ASSETS,
      id: 'abc123',
      data: {
        familyId: FAMILY,
        uid: ADMIN,
        kind: 'encrypted',
        publicId: 'kaydo/fam-1/abc123',
        resourceType: 'raw',
        state: 'pending',
        refs: [],
        createdAt: new Date(NOW),
      },
    }])
  })

  it('signs every parameter the browser will send, and nothing else', async () => {
    // A folder or resource type outside the signature was what let one
    // signature be reused for anything.
    const { params } = await signUpload(deps(), ADMIN, { familyId: FAMILY })
    expect(Object.keys(params).sort()).toEqual(['overwrite', 'public_id', 'tags', 'timestamp'])
  })

  it('defaults to an encrypted upload', async () => {
    const signed = await signUpload(deps(), ADMIN, { familyId: FAMILY })
    expect(signed.resourceType).toBe('raw')
  })

  it('keeps pictures shown without the key under their own prefix', async () => {
    const d = deps()
    const signed = await signUpload(d, ADMIN, { familyId: FAMILY, kind: 'public' })
    expect(signed.resourceType).toBe('image')
    expect(signed.publicId).toBe('kaydo/public/fam-1/abc123')
    expect(d.written[0].data.kind).toBe('public')
  })

  it('accepts an admin of a family from before adminUids', async () => {
    const signed = await signUpload(deps({ family: { adminUid: ADMIN } }), ADMIN, { familyId: FAMILY })
    expect(signed.publicId).toBe('kaydo/fam-1/abc123')
  })

  it.each([
    ['nobody signed in', undefined, { familyId: FAMILY }, 'unauthenticated'],
    ['no family', ADMIN, {}, 'invalid-argument'],
    ['a family id that is a path', ADMIN, { familyId: 'fam-1/../x' }, 'invalid-argument'],
    ['an unknown kind', ADMIN, { familyId: FAMILY, kind: 'video' }, 'invalid-argument'],
    ['a kind from the prototype', ADMIN, { familyId: FAMILY, kind: 'toString' }, 'invalid-argument'],
    ['a viewer or stranger', 'uid-other', { familyId: FAMILY }, 'permission-denied'],
  ])('refuses %s, and records nothing', async (_name, uid, data, code) => {
    const d = deps()
    const error = await signUpload(d, uid, data).catch((e) => e)
    expect(error).toBeInstanceOf(SigningError)
    expect(error.code).toBe(code)
    expect(d.written).toEqual([])
  })

  it('refuses a family that does not exist', async () => {
    const d = deps({ family: null })
    await expect(signUpload(d, ADMIN, { familyId: FAMILY })).rejects.toMatchObject({ code: 'permission-denied' })
    expect(d.written).toEqual([])
  })

  it('gives every upload its own id', async () => {
    const d = deps()
    delete d.randomId
    const a = await signUpload(d, ADMIN, { familyId: FAMILY })
    const b = await signUpload(d, ADMIN, { familyId: FAMILY })
    expect(a.publicId).toMatch(/^kaydo\/fam-1\/[0-9a-f]{32}$/)
    expect(a.publicId).not.toBe(b.publicId)
  })
})
