// @vitest-environment node
/**
 * Upload signatures — functions/mediaSigning.js.
 *
 * The signature is permission to write to the Cloudinary account. It used to
 * cover only a folder and a timestamp, so one signature allowed any number of
 * uploads of any kind for an hour. Now it names one file, and that file is in
 * the ledger before the browser uploads it.
 */
import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import {
  checkQuota,
  cloudinarySignature,
  signUpload,
  SigningError,
  MEDIA_ASSETS,
  MEDIA_RATES,
  MEDIA_USAGE,
  RATE_WINDOW_MS,
} from '../../functions/mediaSigning.js'
import { fakeAdminFirestore } from './fakeAdminFirestore.js'

const FAMILY = 'fam-1'
const ADMIN = 'uid-admin'
const NOW = Date.parse('2026-10-23T10:00:00Z')

const LIMITS = { uploadsPerHour: 3, familyBytes: 1000 }

function deps({ family = { adminUids: [ADMIN] }, seed = {}, ...overrides } = {}) {
  const db = fakeAdminFirestore({ ...(family ? { [`families/${FAMILY}`]: family } : {}), ...seed })
  return {
    db,
    apiKey: 'api-key',
    secret: 'api-secret',
    limits: LIMITS,
    now: () => NOW,
    randomId: () => 'abc123',
    ...overrides,
  }
}

const ledger = (d) => d.db.collectionData(MEDIA_ASSETS)

describe('cloudinarySignature', () => {
  it('signs the parameters sorted by name, as Cloudinary documents it', () => {
    expect(cloudinarySignature({ timestamp: 1315060510, public_id: 'sample_image' }, 'abcd'))
      .toBe(createHash('sha256').update('public_id=sample_image&timestamp=1315060510abcd').digest('hex'))
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

    expect(ledger(d)).toEqual({
      abc123: {
        familyId: FAMILY,
        uid: ADMIN,
        kind: 'encrypted',
        publicId: 'kaydo/fam-1/abc123',
        resourceType: 'raw',
        state: 'pending',
        refs: [],
        createdAt: new Date(NOW),
      },
    })
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
    expect(ledger(d).abc123.kind).toBe('public')
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
    expect(ledger(d)).toEqual({})
  })

  it('refuses a family that does not exist', async () => {
    const d = deps({ family: null })
    await expect(signUpload(d, ADMIN, { familyId: FAMILY })).rejects.toMatchObject({ code: 'permission-denied' })
    expect(ledger(d)).toEqual({})
  })

  it('gives every upload its own id', async () => {
    const d = deps({ randomId: undefined })
    const a = await signUpload(d, ADMIN, { familyId: FAMILY })
    const b = await signUpload(d, ADMIN, { familyId: FAMILY })
    expect(a.publicId).toMatch(/^kaydo\/fam-1\/[0-9a-f]{32}$/)
    expect(a.publicId).not.toBe(b.publicId)
  })

  it('has Cloudinary report the stored file, when there is somewhere to report to', async () => {
    const url = 'https://europe-west3-p.cloudfunctions.net/cloudinaryNotification'
    const { params, signature } = await signUpload(deps({ notificationUrl: url }), ADMIN, { familyId: FAMILY })
    expect(params.notification_url).toBe(url)
    expect(signature).toBe(cloudinarySignature(params, 'api-secret'))
  })

  it('counts the upload against the admin', async () => {
    const d = deps()
    await signUpload(d, ADMIN, { familyId: FAMILY })
    await signUpload({ ...d, randomId: () => 'def456' }, ADMIN, { familyId: FAMILY })
    expect(d.db.collectionData(MEDIA_RATES)[ADMIN]).toEqual({ windowStart: NOW, count: 2 })
  })

  it('refuses past the hourly limit, and records nothing', async () => {
    const d = deps({ seed: { [`${MEDIA_RATES}/${ADMIN}`]: { windowStart: NOW - 1000, count: 3 } } })
    const error = await signUpload(d, ADMIN, { familyId: FAMILY }).catch((e) => e)
    expect(error).toBeInstanceOf(SigningError)
    expect(error.code).toBe('resource-exhausted')
    expect(error.details).toEqual({ reason: 'rate' })
    expect(ledger(d)).toEqual({})
    expect(d.db.collectionData(MEDIA_RATES)[ADMIN].count).toBe(3)
  })

  it('refuses a family whose storage is used up', async () => {
    const d = deps({ seed: { [`${MEDIA_USAGE}/${FAMILY}`]: { bytes: 1000, files: 4 } } })
    const error = await signUpload(d, ADMIN, { familyId: FAMILY }).catch((e) => e)
    expect(error.code).toBe('resource-exhausted')
    expect(error.details).toEqual({ reason: 'storage' })
    expect(ledger(d)).toEqual({})
  })
})

describe('checkQuota', () => {
  const limits = { uploadsPerHour: 2, familyBytes: 100 }

  it('starts a window with the first upload', () => {
    expect(checkQuota({}, NOW, limits)).toEqual({ allowed: true, rate: { windowStart: NOW, count: 1 } })
  })

  it('counts inside the window and refuses at the limit', () => {
    const rate = { windowStart: NOW - 10, count: 1 }
    expect(checkQuota({ rate }, NOW, limits)).toEqual({ allowed: true, rate: { windowStart: NOW - 10, count: 2 } })
    expect(checkQuota({ rate: { ...rate, count: 2 } }, NOW, limits)).toEqual({ allowed: false, reason: 'rate' })
  })

  it('starts over once the window has run out', () => {
    const rate = { windowStart: NOW - RATE_WINDOW_MS, count: 2 }
    expect(checkQuota({ rate }, NOW, limits)).toEqual({ allowed: true, rate: { windowStart: NOW, count: 1 } })
  })

  it('refuses once the family has reached its storage', () => {
    expect(checkQuota({ usage: { bytes: 99 } }, NOW, limits).allowed).toBe(true)
    expect(checkQuota({ usage: { bytes: 100 } }, NOW, limits)).toEqual({ allowed: false, reason: 'storage' })
  })
})
