// @vitest-environment node
/**
 * Deleting a family — functions/familyDeletion.js.
 *
 * It cannot be undone, so these are mostly about who may ask, what waits, and
 * that a run which stops halfway finishes on the next one without touching
 * another family.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  cancelDeletion,
  deleteFamily,
  familiesToDelete,
  requestDeletion,
  DELETION_GRACE_DAYS,
  FAMILY_DELETIONS,
} from '../../functions/familyDeletion.js'
import { fakeAdminFirestore } from './fakeAdminFirestore.js'

const NOW = Date.parse('2026-11-09T03:45:00Z')
const DAY = 24 * 60 * 60 * 1000
const OWNER = 'owner-1'
const CO_ADMIN = 'admin-2'
const hex = (c) => c.repeat(32)

const family = (extra = {}) => ({
  adminUid: OWNER,
  adminUids: [OWNER, CO_ADMIN],
  familyName: 'Hartmann',
  familySlug: 'hartmann',
  ...extra,
})
const due = () => family({ deletion: { requestedBy: OWNER, requestedAt: new Date(NOW - 15 * DAY), deleteAfter: new Date(NOW - DAY) } })

const asset = (c, extra = {}) => [
  `mediaAssets/${hex(c)}`,
  { familyId: 'fam-1', publicId: `kaydo/fam-1/${hex(c)}`, resourceType: 'raw', state: 'attached', refs: ['memories/m1'], ...extra },
]

/** A family with something in every place a deletion has to reach, and a neighbour. */
const seeded = (familyDoc = due()) => fakeAdminFirestore(Object.fromEntries([
  ['families/fam-1', familyDoc],
  ['families/fam-1/admins/owner-1', { email: 'owner@example.test' }],
  ['families/fam-1/invites/token-1', { used: false }],
  ['families/fam-1/secrets/auth', { sharedPassword: 'hash' }],
  ['familyPublic/fam-1', { familyName: 'Hartmann', familySlug: 'hartmann' }],
  ['familySlugs/hartmann', { familyId: 'fam-1' }],
  ['memories/m1', { familyId: 'fam-1' }],
  ['recipes/r1', { familyId: 'fam-1' }],
  ['fcmTokens/t1', { familyId: 'fam-1' }],
  ['viewerDevices/device-hash', { familyId: 'fam-1' }],
  ['rateLimits/viewerDevice__device-hash', { failures: 1 }],
  ['rateLimits/viewerLogin__fam-1', { failures: 2 }],
  ['mediaUsage/fam-1', { bytes: 10, files: 1, unsized: 0 }],
  ['mediaRates/owner-1', { windowStart: 0, count: 1 }],
  asset('a'),
  asset('b', { resourceType: 'image', publicId: `kaydo/public/fam-1/${hex('b')}` }),
  ['families/fam-2', { adminUid: 'owner-9', adminUids: ['owner-9'], familySlug: 'other' }],
  ['memories/m9', { familyId: 'fam-2' }],
  ['mediaAssets/' + hex('9'), { familyId: 'fam-2', publicId: `kaydo/fam-2/${hex('9')}`, resourceType: 'raw' }],
  ['familySlugs/other', { familyId: 'fam-2' }],
]))

const deps = (db, extra = {}) => {
  const printFile = { delete: vi.fn(async () => {}) }
  return {
    db,
    bucket: { getFiles: vi.fn(async () => [[printFile]]) },
    auth: { deleteUser: vi.fn(async () => {}) },
    destroy: vi.fn(async (_type, ids) => new Set(ids)),
    now: () => NOW,
    printFile,
    ...extra,
  }
}

describe('requestDeletion', () => {
  it('schedules the deletion two weeks out, for the owner', async () => {
    const db = fakeAdminFirestore({ 'families/fam-1': family() })
    const answer = await requestDeletion({ db, now: () => NOW }, OWNER, { familyId: 'fam-1' })
    expect(answer.deleteAfter).toBe(new Date(NOW + DELETION_GRACE_DAYS * DAY).toISOString())
    expect(db.docs.get('families/fam-1').deletion).toMatchObject({ requestedBy: OWNER, deleteAfter: new Date(NOW + DELETION_GRACE_DAYS * DAY) })
  })

  it('refuses a co-admin, a stranger, and nobody at all', async () => {
    const db = fakeAdminFirestore({ 'families/fam-1': family() })
    await expect(requestDeletion({ db }, CO_ADMIN, { familyId: 'fam-1' })).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(requestDeletion({ db }, 'stranger', { familyId: 'fam-1' })).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(requestDeletion({ db }, undefined, { familyId: 'fam-1' })).rejects.toMatchObject({ code: 'unauthenticated' })
    await expect(requestDeletion({ db }, OWNER, { familyId: 'no/such' })).rejects.toMatchObject({ code: 'invalid-argument' })
    await expect(requestDeletion({ db }, OWNER, { familyId: 'missing' })).rejects.toMatchObject({ code: 'permission-denied' })
    expect(db.docs.get('families/fam-1').deletion).toBeUndefined()
  })

  it('keeps the date the owner was first told when asked again', async () => {
    const db = fakeAdminFirestore({ 'families/fam-1': family() })
    const first = await requestDeletion({ db, now: () => NOW }, OWNER, { familyId: 'fam-1' })
    const second = await requestDeletion({ db, now: () => NOW + 3 * DAY }, OWNER, { familyId: 'fam-1' })
    expect(second).toEqual(first)
  })
})

describe('cancelDeletion', () => {
  it('takes a scheduled deletion back, for the owner only', async () => {
    const db = fakeAdminFirestore({ 'families/fam-1': due() })
    await expect(cancelDeletion({ db }, CO_ADMIN, { familyId: 'fam-1' })).rejects.toMatchObject({ code: 'permission-denied' })
    await cancelDeletion({ db }, OWNER, { familyId: 'fam-1' })
    expect(db.docs.get('families/fam-1').deletion).toBeNull()
    expect(await familiesToDelete(db, NOW)).toEqual([])
  })

  it('refuses once the deletion has begun', async () => {
    const db = fakeAdminFirestore({ 'families/fam-1': due(), [`${FAMILY_DELETIONS}/fam-1`]: { ownerUid: OWNER } })
    await expect(cancelDeletion({ db }, OWNER, { familyId: 'fam-1' })).rejects.toMatchObject({ code: 'failed-precondition' })
    expect(db.docs.get('families/fam-1').deletion).not.toBeNull()
  })
})

describe('familiesToDelete', () => {
  it('finds the families whose date has come and the ones already begun', async () => {
    const db = fakeAdminFirestore({
      'families/due': due(),
      'families/waiting': family({ deletion: { deleteAfter: new Date(NOW + DAY) } }),
      'families/kept': family(),
      'families/cancelled': family({ deletion: null }),
      [`${FAMILY_DELETIONS}/half-gone`]: { ownerUid: OWNER },
    })
    expect((await familiesToDelete(db, NOW)).sort()).toEqual(['due', 'half-gone'])
  })
})

describe('deleteFamily', () => {
  it('deletes everything of the family, and nothing of another', async () => {
    const db = seeded()
    const d = deps(db)
    const stats = await deleteFamily(d, 'fam-1')

    expect(stats).toMatchObject({ outcome: 'deleted', files: 2, printFiles: 1, ownerAccountDeleted: true })
    expect([...db.docs.keys()].sort()).toEqual([
      'families/fam-2',
      'familySlugs/other',
      'mediaAssets/' + hex('9'),
      'memories/m9',
    ])
    expect(d.destroy).toHaveBeenCalledWith('raw', [`kaydo/fam-1/${hex('a')}`])
    expect(d.destroy).toHaveBeenCalledWith('image', [`kaydo/public/fam-1/${hex('b')}`])
    expect(d.bucket.getFiles).toHaveBeenCalledWith({ prefix: 'printFiles/fam-1/' })
    expect(d.printFile.delete).toHaveBeenCalled()
    expect(d.auth.deleteUser.mock.calls.map(([uid]) => uid)).toEqual(['viewer:fam-1', OWNER])
  })

  it('does nothing before the date, or once the request was taken back', async () => {
    for (const doc of [family(), family({ deletion: null }), family({ deletion: { deleteAfter: new Date(NOW + DAY) } })]) {
      const db = seeded(doc)
      const d = deps(db)
      const before = db.docs.size
      expect(await deleteFamily(d, 'fam-1')).toMatchObject({ outcome: 'not-due' })
      expect(db.docs.size).toBe(before)
      expect(d.destroy).not.toHaveBeenCalled()
      expect(d.auth.deleteUser).not.toHaveBeenCalled()
    }
  })

  it('does nothing for a family that does not exist', async () => {
    const db = seeded()
    expect(await deleteFamily(deps(db), 'nobody')).toMatchObject({ outcome: 'not-due' })
  })

  it('keeps the family document and the ledger entry while Cloudinary refuses, and finishes on the next run', async () => {
    const db = seeded()
    const refusing = deps(db, { destroy: vi.fn(async (type, ids) => (type === 'raw' ? new Set() : new Set(ids))) })
    const first = await deleteFamily(refusing, 'fam-1')
    expect(first).toMatchObject({ outcome: 'incomplete', filesRefused: 1 })
    expect(db.docs.has('families/fam-1')).toBe(true)
    expect(db.docs.has('mediaAssets/' + hex('a'))).toBe(true)
    expect(db.docs.has(`${FAMILY_DELETIONS}/fam-1`)).toBe(true)
    expect(refusing.auth.deleteUser).not.toHaveBeenCalled()

    expect(await familiesToDelete(db, NOW)).toEqual(['fam-1'])
    const second = await deleteFamily(deps(db), 'fam-1')
    expect(second).toMatchObject({ outcome: 'deleted' })
    expect(db.docs.has('families/fam-1')).toBe(false)
    expect(db.docs.has(`${FAMILY_DELETIONS}/fam-1`)).toBe(false)
  })

  it('waits with the files when Cloudinary is not configured', async () => {
    const db = seeded()
    const stats = await deleteFamily(deps(db, { destroy: null }), 'fam-1')
    expect(stats).toMatchObject({ outcome: 'incomplete', filesRefused: 2 })
    expect(db.docs.has('families/fam-1')).toBe(true)
  })

  it('finishes a deletion whose family document is already gone', async () => {
    const db = seeded()
    db.docs.delete('families/fam-1')
    db.docs.set(`${FAMILY_DELETIONS}/fam-1`, { ownerUid: OWNER, familySlug: 'hartmann' })
    const d = deps(db)
    expect(await deleteFamily(d, 'fam-1')).toMatchObject({ outcome: 'deleted' })
    expect(db.docs.has('memories/m1')).toBe(false)
    expect(db.docs.has('familySlugs/hartmann')).toBe(false)
    expect(d.auth.deleteUser).toHaveBeenCalledWith(OWNER)
  })

  it('stops when it runs out of time, and leaves the rest for the next run', async () => {
    const db = seeded()
    let clock = NOW
    const stats = await deleteFamily(deps(db, { now: () => clock++, deadline: NOW + 2 }), 'fam-1')
    expect(stats.outcome).toBe('incomplete')
    expect(db.docs.has('families/fam-1')).toBe(true)
    expect(db.docs.has(`${FAMILY_DELETIONS}/fam-1`)).toBe(true)
  })

  it('keeps the account of an owner who is an admin of another family', async () => {
    const db = seeded()
    db.docs.set('families/fam-2', { adminUid: 'owner-9', adminUids: ['owner-9', OWNER] })
    const d = deps(db)
    const stats = await deleteFamily(d, 'fam-1')
    expect(stats).toMatchObject({ outcome: 'deleted', ownerAccountDeleted: false })
    expect(d.auth.deleteUser.mock.calls.map(([uid]) => uid)).toEqual(['viewer:fam-1'])
    expect(db.docs.has('mediaRates/owner-1')).toBe(true)
  })

  it('never deletes a co-admin\'s account', async () => {
    const db = seeded()
    const d = deps(db)
    await deleteFamily(d, 'fam-1')
    expect(d.auth.deleteUser).not.toHaveBeenCalledWith(CO_ADMIN)
  })

  it('leaves a file from before the ledger on Cloudinary, and counts it', async () => {
    const db = seeded()
    db.docs.set('mediaAssets/legacy~raw~x', { familyId: 'fam-1', legacy: true, publicId: 'kaydo/old/x', resourceType: 'raw' })
    const d = deps(db)
    const stats = await deleteFamily(d, 'fam-1')
    expect(stats).toMatchObject({ outcome: 'deleted', legacyFilesKept: 1 })
    expect(d.destroy.mock.calls.flatMap(([, ids]) => ids)).not.toContain('kaydo/old/x')
    expect(db.docs.has('mediaAssets/legacy~raw~x')).toBe(false)
  })

  it('carries on when the accounts are already gone', async () => {
    const db = seeded()
    const gone = Object.assign(new Error('gone'), { code: 'auth/user-not-found' })
    const d = deps(db, { auth: { deleteUser: vi.fn(async () => { throw gone }) } })
    expect(await deleteFamily(d, 'fam-1')).toMatchObject({ outcome: 'deleted', ownerAccountDeleted: false })
  })
})
