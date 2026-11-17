// @vitest-environment node
/**
 * The public mirror — mirrorFamily in functions/slugs.js.
 *
 * The trigger is retried for up to an hour and Firestore does not promise to
 * deliver events in order, so the mirror must follow the family document as it
 * is now and take nothing from the event. These are the two stale-event cases
 * of the security review, plus the address handling that moved with them.
 */
import { describe, it, expect } from 'vitest'
import { mirrorFamily, DELETION_MARKERS, SLUGS } from '../../functions/slugs.js'
import { FAMILY_DELETIONS } from '../../functions/familyDeletion.js'
import { fakeAdminFirestore } from './fakeAdminFirestore.js'

const FIELDS = ['familySlug', 'familyName', 'loginHeaderImage', 'loginTheme']

describe('mirrorFamily', () => {
  it('uses the marker collection the deletion writes', () => {
    expect(DELETION_MARKERS).toBe(FAMILY_DELETIONS)
  })

  it('does not bring back a login image that was removed, whatever event arrives late', async () => {
    // The family document no longer has the image; an older event that still
    // had it is run now. Nothing of the event reaches mirrorFamily at all.
    const db = fakeAdminFirestore({
      'families/fam-1': { familyName: 'Hartmann', familySlug: 'hartmann' },
      'familyPublic/fam-1': { familyName: 'Hartmann', familySlug: 'hartmann', loginHeaderImage: 'https://example.test/old.jpg' },
      'familySlugs/hartmann': { familyId: 'fam-1' },
    })
    expect(await mirrorFamily(db, 'fam-1', FIELDS)).toBe('mirrored')
    expect(db.docs.get('familyPublic/fam-1')).toEqual({ familyName: 'Hartmann', familySlug: 'hartmann' })
  })

  it('does not recreate the mirror or the address of a family that is gone', async () => {
    const db = fakeAdminFirestore({
      'familyPublic/fam-1': { familyName: 'Hartmann', familySlug: 'hartmann' },
      'familySlugs/hartmann': { familyId: 'fam-1' },
      'familySlugs/other': { familyId: 'fam-2' },
      'familyPublic/fam-2': { familySlug: 'other' },
      'families/fam-2': { familySlug: 'other' },
    })
    expect(await mirrorFamily(db, 'fam-1', FIELDS)).toBe('removed')
    expect(db.docs.has('familyPublic/fam-1')).toBe(false)
    expect(db.docs.has('familySlugs/hartmann')).toBe(false)
    // Another family's address stays, even though an event could name it.
    expect(db.docs.has('familySlugs/other')).toBe(true)
    expect(db.docs.has('familyPublic/fam-2')).toBe(true)
    // And once more, as a retry would: still nothing.
    expect(await mirrorFamily(db, 'fam-1', FIELDS)).toBe('removed')
    expect(db.docs.has('familyPublic/fam-1')).toBe(false)
  })

  it('leaves a family alone whose deletion has begun', async () => {
    const db = fakeAdminFirestore({
      'families/fam-1': { familyName: 'Hartmann', familySlug: 'hartmann' },
      [`${FAMILY_DELETIONS}/fam-1`]: { ownerUid: 'owner-1' },
    })
    expect(await mirrorFamily(db, 'fam-1', FIELDS)).toBe('deleting')
    expect(db.docs.has('familyPublic/fam-1')).toBe(false)
    expect(db.docs.has(`${SLUGS}/hartmann`)).toBe(false)
  })

  it('registers the address, mirrors only the allowed fields, and clears what was cleared', async () => {
    const db = fakeAdminFirestore({
      'families/fam-1': { familyName: 'Hartmann', familySlug: 'hartmann', encryptionKey: 'secret' },
      'familyPublic/fam-1': { loginTheme: 'stale' },
    })
    await mirrorFamily(db, 'fam-1', FIELDS)
    expect(db.docs.get('familyPublic/fam-1')).toEqual({ familyName: 'Hartmann', familySlug: 'hartmann' })
    expect(db.docs.get('familySlugs/hartmann')).toMatchObject({ familyId: 'fam-1' })
  })

  it('moves the address on a rename, and keeps the old one when the new one is taken', async () => {
    const db = fakeAdminFirestore({
      'families/fam-1': { familySlug: 'the-millers' },
      'familySlugs/the-millers': { familyId: 'fam-1' },
      'familySlugs/the-smiths': { familyId: 'fam-2' },
    })
    await mirrorFamily(db, 'fam-1', FIELDS)
    expect(db.docs.get('familyPublic/fam-1')).toEqual({ familySlug: 'the-millers' })

    db.docs.set('families/fam-1', { familySlug: 'the-smiths' })
    await mirrorFamily(db, 'fam-1', FIELDS)
    expect(db.docs.get('familyPublic/fam-1')).toEqual({ familySlug: 'the-millers' })
    expect(db.docs.get('familySlugs/the-millers')).toMatchObject({ familyId: 'fam-1' })
    expect(db.docs.get('familySlugs/the-smiths')).toMatchObject({ familyId: 'fam-2' })

    db.docs.set('families/fam-1', { familySlug: 'the-miller-clan' })
    await mirrorFamily(db, 'fam-1', FIELDS)
    expect(db.docs.get('familyPublic/fam-1')).toEqual({ familySlug: 'the-miller-clan' })
    expect(db.docs.has('familySlugs/the-millers')).toBe(false)
    expect(db.docs.get('familySlugs/the-miller-clan')).toMatchObject({ familyId: 'fam-1' })
  })

  it('gives a reserved address to nobody new, but lets its holder keep it', async () => {
    const db = fakeAdminFirestore({ 'families/fam-1': { familySlug: 'admin' } })
    await mirrorFamily(db, 'fam-1', FIELDS)
    expect(db.docs.get('familyPublic/fam-1')).toEqual({})
    expect(db.docs.has('familySlugs/admin')).toBe(false)

    const legacy = fakeAdminFirestore({
      'families/fam-1': { familySlug: 'support' },
      'familyPublic/fam-1': { familySlug: 'support' },
    })
    await mirrorFamily(legacy, 'fam-1', FIELDS)
    expect(legacy.docs.get('familyPublic/fam-1')).toEqual({ familySlug: 'support' })
  })

  it('releases the address when the family stops having one', async () => {
    const db = fakeAdminFirestore({
      'families/fam-1': { familyName: 'Hartmann' },
      'familySlugs/hartmann': { familyId: 'fam-1' },
    })
    await mirrorFamily(db, 'fam-1', FIELDS)
    expect(db.docs.has('familySlugs/hartmann')).toBe(false)
    expect(db.docs.get('familyPublic/fam-1')).toEqual({ familyName: 'Hartmann' })
  })
})
