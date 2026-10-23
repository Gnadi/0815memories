// @vitest-environment node
/**
 * Cloudinary's upload notifications — functions/mediaNotification.js.
 *
 * The URL is public, so a notification counts only with Cloudinary's
 * signature, only for a file signUpload recorded, and only once: what it
 * writes is what the family's storage quota reads.
 */
import { describe, it, expect } from 'vitest'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { recordUpload, verifyNotification, NOTIFICATION_MAX_AGE_MS } from '../../functions/mediaNotification.js'
import { MEDIA_ASSETS, MEDIA_USAGE } from '../../functions/mediaSigning.js'
import { fakeAdminFirestore } from './fakeAdminFirestore.js'

const SECRET = 'api-secret'
const NOW = Date.parse('2026-10-23T10:00:00Z')
const TS = String(NOW / 1000)
const PUBLIC_ID = 'kaydo/fam-1/abc123'

const sign = (body, ts = TS, algorithm = 'sha1') =>
  createHash(algorithm).update(`${body}${ts}${SECRET}`).digest('hex')

describe('verifyNotification', () => {
  const body = JSON.stringify({ notification_type: 'upload', public_id: PUBLIC_ID, bytes: 10 })

  it('accepts what Cloudinary signed, with either hash', () => {
    expect(verifyNotification(Buffer.from(body), TS, sign(body), SECRET, NOW)).toBe(true)
    expect(verifyNotification(Buffer.from(body), TS, sign(body, TS, 'sha256'), SECRET, NOW)).toBe(true)
  })

  it('refuses a changed body', () => {
    const forged = body.replace('"bytes":10', '"bytes":1')
    expect(verifyNotification(Buffer.from(forged), TS, sign(body), SECRET, NOW)).toBe(false)
  })

  it('refuses a signature made with another secret', () => {
    const other = createHash('sha1').update(`${body}${TS}other`).digest('hex')
    expect(verifyNotification(Buffer.from(body), TS, other, SECRET, NOW)).toBe(false)
  })

  it('refuses a notification that is too old', () => {
    const old = String((NOW - NOTIFICATION_MAX_AGE_MS - 1000) / 1000)
    expect(verifyNotification(Buffer.from(body), old, sign(body, old), SECRET, NOW)).toBe(false)
  })

  it('refuses anything missing', () => {
    expect(verifyNotification(undefined, TS, sign(body), SECRET, NOW)).toBe(false)
    expect(verifyNotification(Buffer.from(body), undefined, sign(body), SECRET, NOW)).toBe(false)
    expect(verifyNotification(Buffer.from(body), TS, undefined, SECRET, NOW)).toBe(false)
    expect(verifyNotification(Buffer.from(body), TS, sign(body), '', NOW)).toBe(false)
    expect(verifyNotification(Buffer.from(body), 'soon', sign(body, 'soon'), SECRET, NOW)).toBe(false)
  })
})

describe('recordUpload', () => {
  const pending = () => fakeAdminFirestore({
    [`${MEDIA_ASSETS}/abc123`]: { familyId: 'fam-1', publicId: PUBLIC_ID, state: 'pending' },
    [`${MEDIA_USAGE}/fam-1`]: { bytes: 500, files: 2 },
  })
  const upload = (overrides = {}) => ({ notification_type: 'upload', public_id: PUBLIC_ID, bytes: 120, ...overrides })

  it('puts the size on the entry and adds it to the family', async () => {
    const db = pending()
    expect(await recordUpload({ db, now: () => NOW }, upload())).toBe('recorded')
    expect(db.collectionData(MEDIA_ASSETS).abc123).toMatchObject({ bytes: 120, uploadedAt: new Date(NOW), state: 'pending' })
    expect(db.collectionData(MEDIA_USAGE)['fam-1']).toEqual({ bytes: 620, files: 3 })
  })

  it('starts a family’s usage with its first file', async () => {
    const db = fakeAdminFirestore({ [`${MEDIA_ASSETS}/abc123`]: { familyId: 'fam-1', publicId: PUBLIC_ID } })
    await recordUpload({ db }, upload())
    expect(db.collectionData(MEDIA_USAGE)['fam-1']).toEqual({ bytes: 120, files: 1 })
  })

  it('counts a file once, however often it is reported', async () => {
    const db = pending()
    await recordUpload({ db }, upload())
    expect(await recordUpload({ db }, upload())).toBe('duplicate')
    expect(db.collectionData(MEDIA_USAGE)['fam-1']).toEqual({ bytes: 620, files: 3 })
  })

  it('records nothing for a file the ledger does not know', async () => {
    const db = pending()
    expect(await recordUpload({ db }, upload({ public_id: 'kaydo/fam-1/other' }))).toBe('unknown')
    // Same ledger id under another path: not the file signUpload named.
    expect(await recordUpload({ db }, upload({ public_id: 'kaydo/fam-2/abc123' }))).toBe('unknown')
    expect(db.collectionData(MEDIA_USAGE)['fam-1']).toEqual({ bytes: 500, files: 2 })
  })

  it.each([
    ['another notification type', { notification_type: 'delete' }],
    ['no public id', { public_id: undefined }],
    ['no size', { bytes: undefined }],
    ['a negative size', { bytes: -5 }],
  ])('ignores %s', async (_name, overrides) => {
    const db = pending()
    expect(await recordUpload({ db }, upload(overrides))).toBe('ignored')
    expect(db.collectionData(MEDIA_USAGE)['fam-1']).toEqual({ bytes: 500, files: 2 })
  })
})
