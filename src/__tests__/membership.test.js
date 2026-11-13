// @vitest-environment node
/**
 * Joining a family with an invite, and being removed — functions/membership.js.
 *
 * These carry what the rules used to be tested for, when the browser made the
 * writes itself: an invite works once, not after a removal, and never for a
 * removed admin again; the owner always stays.
 */
import { describe, it, expect, vi } from 'vitest'
import { deleteFcmTokens, redeemInvite, removeAdmin } from '../../functions/membership.js'
import { fakeAdminFirestore } from './fakeAdminFirestore.js'

const NOW = Date.parse('2026-11-10T10:00:00Z')
const DAY = 24 * 60 * 60 * 1000
const OWNER = 'uid-owner'
const ADMIN = 'uid-admin'
const NEWBIE = 'uid-newbie'
const TOKEN = 'invite-token-1'

const invite = (extra = {}) => ({ createdBy: OWNER, used: false, redeemedBy: null, expiresAt: new Date(NOW + DAY), ...extra })
const seeded = ({ family = {}, invites = { [TOKEN]: invite() } } = {}) => fakeAdminFirestore({
  'families/fam-1': { adminUid: OWNER, adminUids: [OWNER, ADMIN], familyName: 'Hartmann', ...family },
  'families/fam-1/admins/uid-admin': { email: 'admin@example.test', viaInvite: 'old' },
  ...Object.fromEntries(Object.entries(invites).map(([id, data]) => [`families/fam-1/invites/${id}`, data])),
})

const newbie = (extra = {}) => ({ uid: NEWBIE, email: ' New@Example.test ', emailVerified: true, ...extra })
const redeem = (db, caller = newbie(), data = { familyId: 'fam-1', token: TOKEN }) =>
  redeemInvite({ db, now: () => NOW }, caller, data)
const family = (db) => db.docs.get('families/fam-1')

describe('redeemInvite', () => {
  it('makes the redeemer an admin and spends the invite', async () => {
    const db = seeded()
    await redeem(db)
    expect(family(db).adminUids).toEqual([OWNER, ADMIN, NEWBIE])
    expect(db.docs.get(`families/fam-1/invites/${TOKEN}`)).toMatchObject({ used: true, redeemedBy: NEWBIE })
    // The address is the token's, tidied; nothing else of the family changed.
    expect(db.docs.get(`families/fam-1/admins/${NEWBIE}`)).toMatchObject({ email: 'new@example.test', viaInvite: TOKEN })
    expect(family(db)).toMatchObject({ adminUid: OWNER, familyName: 'Hartmann' })
  })

  it('needs an account of one\'s own with a confirmed address', async () => {
    const db = seeded()
    await expect(redeem(db, {})).rejects.toMatchObject({ code: 'unauthenticated' })
    await expect(redeem(db, newbie({ emailVerified: false }))).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(redeem(db, newbie({ emailVerified: undefined }))).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(redeem(db, newbie({ uid: 'viewer:fam-1', role: 'viewer' }))).rejects.toMatchObject({ code: 'permission-denied' })
    expect(family(db).adminUids).toEqual([OWNER, ADMIN])
  })

  it('works once', async () => {
    const db = seeded()
    await redeem(db)
    await expect(redeem(db, newbie({ uid: 'uid-second' }))).rejects.toMatchObject({ code: 'failed-precondition' })
    expect(family(db).adminUids).toEqual([OWNER, ADMIN, NEWBIE])
  })

  it('answers every unusable invite the same way, and changes nothing', async () => {
    const cases = [
      seeded({ invites: {} }),
      seeded({ invites: { [TOKEN]: invite({ used: true, redeemedBy: 'someone' }) } }),
      seeded({ invites: { [TOKEN]: invite({ expiresAt: new Date(NOW - 1) }) } }),
      seeded({ invites: { [TOKEN]: invite({ expiresAt: undefined }) } }),
      seeded({ family: { inviteEpoch: 1 } }),
      seeded({ invites: { [TOKEN]: invite({ epoch: 2 }) }, family: { inviteEpoch: 1 } }),
    ]
    for (const db of cases) {
      await expect(redeem(db)).rejects.toMatchObject({ code: 'failed-precondition', message: 'This invite can no longer be used' })
      expect(family(db).adminUids).toEqual([OWNER, ADMIN])
      expect(db.docs.has(`families/fam-1/admins/${NEWBIE}`)).toBe(false)
    }
    const db = seeded()
    await expect(redeem(db, newbie(), { familyId: 'fam-1', token: 'no/such' })).rejects.toMatchObject({ code: 'failed-precondition' })
    await expect(redeem(db, newbie(), { familyId: 'missing', token: TOKEN })).rejects.toMatchObject({ code: 'failed-precondition' })
    await expect(redeem(db, newbie(), { familyId: 'a/b', token: TOKEN })).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('accepts an invite of the family\'s current epoch', async () => {
    const db = seeded({ invites: { [TOKEN]: invite({ epoch: 1 }) }, family: { inviteEpoch: 1 } })
    await redeem(db)
    expect(family(db).adminUids).toContain(NEWBIE)
  })

  it('leaves the invite alone when an admin of the family opens it', async () => {
    const db = seeded()
    await expect(redeem(db, newbie({ uid: ADMIN }))).rejects.toMatchObject({ code: 'failed-precondition' })
    expect(db.docs.get(`families/fam-1/invites/${TOKEN}`).used).toBe(false)
  })
})

describe('removeAdmin', () => {
  const remove = (db, caller, target) => removeAdmin({ db }, caller, { familyId: 'fam-1', uid: target })

  it('takes the admin out, with their entry and every pending invite', async () => {
    const db = seeded({ invites: { [TOKEN]: invite(), other: invite({ createdBy: ADMIN }), spent: invite({ used: true }) } })
    await remove(db, OWNER, ADMIN)
    expect(family(db)).toMatchObject({ adminUids: [OWNER], inviteEpoch: 1, adminUid: OWNER })
    expect(db.docs.has('families/fam-1/admins/uid-admin')).toBe(false)
    expect([...db.docs.keys()].filter((path) => path.includes('/invites/'))).toEqual(['families/fam-1/invites/spent'])
  })

  it('lets an admin leave, and one admin remove another', async () => {
    const leaving = seeded()
    await remove(leaving, ADMIN, ADMIN)
    expect(family(leaving).adminUids).toEqual([OWNER])

    const db = seeded({ family: { adminUids: [OWNER, ADMIN, 'uid-third'], inviteEpoch: 4 } })
    await remove(db, ADMIN, 'uid-third')
    expect(family(db)).toMatchObject({ adminUids: [OWNER, ADMIN], inviteEpoch: 5 })
  })

  it('stops the removed admin\'s push notifications, and nobody else\'s', async () => {
    const db = seeded()
    db.docs.set('fcmTokens/mine', { familyId: 'fam-1', uid: ADMIN, token: 'a' })
    db.docs.set('fcmTokens/mine-too', { familyId: 'fam-1', uid: ADMIN, token: 'b' })
    db.docs.set('fcmTokens/owner', { familyId: 'fam-1', uid: OWNER, token: 'c' })
    db.docs.set('fcmTokens/viewer', { familyId: 'fam-1', uid: 'viewer:fam-1', token: 'd' })
    db.docs.set('fcmTokens/elsewhere', { familyId: 'fam-2', uid: ADMIN, token: 'e' })
    await remove(db, OWNER, ADMIN)
    expect(Object.keys(db.collectionData('fcmTokens')).sort()).toEqual(['elsewhere', 'owner', 'viewer'])
  })

  it('still removes the admin when the push tokens cannot be deleted', async () => {
    const db = seeded()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const collection = db.collection
    db.collection = (name) => {
      if (name === 'fcmTokens') throw new Error('unavailable')
      return collection(name)
    }
    await remove(db, OWNER, ADMIN)
    expect(family(db).adminUids).toEqual([OWNER])
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it('never removes the owner, whoever asks', async () => {
    const db = seeded()
    await expect(remove(db, ADMIN, OWNER)).rejects.toMatchObject({ code: 'failed-precondition' })
    await expect(remove(db, OWNER, OWNER)).rejects.toMatchObject({ code: 'failed-precondition' })
    expect(family(db).adminUids).toEqual([OWNER, ADMIN])
    expect(family(db).inviteEpoch).toBeUndefined()
  })

  it('refuses anyone the family document does not list', async () => {
    const db = seeded()
    await expect(remove(db, 'uid-removed', ADMIN)).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(remove(db, undefined, ADMIN)).rejects.toMatchObject({ code: 'unauthenticated' })
    await expect(removeAdmin({ db }, OWNER, { familyId: 'missing', uid: ADMIN })).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(remove(db, OWNER, 'uid-nobody')).rejects.toMatchObject({ code: 'failed-precondition' })
    await expect(remove(db, OWNER, '')).rejects.toMatchObject({ code: 'invalid-argument' })
    expect(family(db).adminUids).toEqual([OWNER, ADMIN])
  })

  it('keeps a removed admin out: their spent invite and any link they kept are dead', async () => {
    const db = seeded({ family: { adminUids: [OWNER] } })
    await redeem(db)
    // A link minted while they were in, which they could have copied.
    db.docs.set('families/fam-1/invites/kept', invite({ epoch: 0 }))
    await remove(db, OWNER, NEWBIE)

    await expect(redeem(db)).rejects.toMatchObject({ code: 'failed-precondition' })
    await expect(redeem(db, newbie(), { familyId: 'fam-1', token: 'kept' })).rejects.toMatchObject({ code: 'failed-precondition' })
    // Even put back by hand, a link of the old epoch stays dead.
    db.docs.set('families/fam-1/invites/kept', invite({ epoch: 0 }))
    await expect(redeem(db, newbie(), { familyId: 'fam-1', token: 'kept' })).rejects.toMatchObject({ code: 'failed-precondition' })
    expect(family(db).adminUids).toEqual([OWNER])
  })
})

describe('deleteFcmTokens', () => {
  it('deletes one identity\'s registrations in one family, in as many pages as it takes', async () => {
    const db = fakeAdminFirestore({
      'fcmTokens/other-family': { familyId: 'fam-2', uid: 'viewer:fam-1' },
      'fcmTokens/admin': { familyId: 'fam-1', uid: ADMIN },
    })
    for (let i = 0; i < 450; i++) db.docs.set(`fcmTokens/v${i}`, { familyId: 'fam-1', uid: 'viewer:fam-1' })
    expect(await deleteFcmTokens(db, 'fam-1', 'viewer:fam-1')).toBe(450)
    expect(Object.keys(db.collectionData('fcmTokens')).sort()).toEqual(['admin', 'other-family'])
  })
})
