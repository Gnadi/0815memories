// @vitest-environment node
/**
 * Leave to upload a print file — functions/printReservations.js.
 *
 * storage.rules accept an upload only into a folder issued here, so these are
 * the limits on how much of the shared bucket one family can fill: admins
 * only, never a family being deleted, and a few reservations per 30 days.
 */
import { describe, it, expect } from 'vitest'
import {
  reservePrintUpload,
  ReservationError,
  PRINT_QUOTA_WINDOW_DAYS,
  RESERVATION_VALID_MS,
  DEFAULT_PRINT_RESERVATIONS_PER_WINDOW,
} from '../../functions/printReservations.js'
import { fakeAdminFirestore } from './fakeAdminFirestore.js'

const NOW = Date.parse('2026-11-17T10:00:00Z')
const DAY = 24 * 60 * 60 * 1000
const FAMILY = 'fam-1'
const ADMIN = 'uid-admin'

const family = (extra = {}) => ({ [`families/${FAMILY}`]: { adminUids: [ADMIN], ...extra } })
const reservation = (ageDays, familyId = FAMILY) => ({ familyId, createdBy: ADMIN, createdAt: new Date(NOW - ageDays * DAY), expireAt: new Date(NOW - ageDays * DAY + RESERVATION_VALID_MS) })

let counter = 0
function reserve(db, { uid = ADMIN, data = { familyId: FAMILY }, limit } = {}) {
  return reservePrintUpload({ db, now: () => NOW, limit, randomId: () => `id-${++counter}` }, uid ?? undefined, data)
}
const codeOf = (promise) => promise.then(() => null, (error) => (error instanceof ReservationError ? error.code : error))

describe('reservePrintUpload', () => {
  it('issues a server-chosen folder to an admin, good for an hour', async () => {
    const db = fakeAdminFirestore(family())
    const answer = await reserve(db)
    expect(answer.printId).toMatch(/^id-/)
    expect(answer.expiresAt).toBe(new Date(NOW + RESERVATION_VALID_MS).toISOString())
    const stored = db.docs.get(`printReservations/${answer.printId}`)
    expect(stored).toMatchObject({ familyId: FAMILY, createdBy: ADMIN })
    expect(stored.createdAt.getTime()).toBe(NOW)
    expect(stored.expireAt.getTime()).toBe(NOW + RESERVATION_VALID_MS)
  })

  it('refuses anyone who is not signed in or not an admin of that family', async () => {
    const db = fakeAdminFirestore(family())
    expect(await codeOf(reserve(db, { uid: null }))).toBe('unauthenticated')
    expect(await codeOf(reserve(db, { uid: 'uid-stranger' }))).toBe('permission-denied')
    expect(await codeOf(reserve(db, { data: { familyId: 'no-such-family' } }))).toBe('permission-denied')
    expect(await codeOf(reserve(db, { data: {} }))).toBe('invalid-argument')
    expect(await codeOf(reserve(db, { data: { familyId: 'a/b' } }))).toBe('invalid-argument')
    expect(db.collectionData('printReservations')).toEqual({})
  })

  it('refuses a family whose deletion is due or has begun', async () => {
    const due = fakeAdminFirestore(family({ deletion: { deleteAfter: new Date(NOW - 1000) } }))
    expect(await codeOf(reserve(due))).toBe('failed-precondition')
    const begun = fakeAdminFirestore({ ...family(), [`familyDeletions/${FAMILY}`]: { startedAt: new Date(NOW) } })
    expect(await codeOf(reserve(begun))).toBe('failed-precondition')
    // A deletion that is only requested still lets the family finish its book.
    const requested = fakeAdminFirestore(family({ deletion: { deleteAfter: new Date(NOW + 5 * DAY) } }))
    expect(await codeOf(reserve(requested))).toBeNull()
  })

  it('allows a few reservations in 30 days, then says the quota is used', async () => {
    const db = fakeAdminFirestore(family())
    for (let i = 0; i < DEFAULT_PRINT_RESERVATIONS_PER_WINDOW; i++) await reserve(db)
    expect(await codeOf(reserve(db))).toBe('resource-exhausted')
    expect(Object.keys(db.collectionData('printReservations'))).toHaveLength(DEFAULT_PRINT_RESERVATIONS_PER_WINDOW)
  })

  it('counts an unused or expired reservation too, and takes the limit from the caller', async () => {
    const db = fakeAdminFirestore({ ...family(), 'printReservations/old-1': reservation(2), 'printReservations/old-2': reservation(20) })
    expect(await codeOf(reserve(db, { limit: 2 }))).toBe('resource-exhausted')
    expect(await codeOf(reserve(db, { limit: 3 }))).toBeNull()
  })

  it('counts only its own family, and lets the window roll on', async () => {
    const seed = { ...family() }
    for (let i = 0; i < 5; i++) seed[`printReservations/other-${i}`] = reservation(1, 'fam-2')
    for (let i = 0; i < 5; i++) seed[`printReservations/old-${i}`] = reservation(PRINT_QUOTA_WINDOW_DAYS + 1)
    const db = fakeAdminFirestore(seed)
    expect(await codeOf(reserve(db))).toBeNull()
    // Those past the window have done their counting and are cleared away.
    const left = Object.keys(db.collectionData('printReservations'))
    expect(left.filter((id) => id.startsWith('old-'))).toEqual([])
    expect(left.filter((id) => id.startsWith('other-'))).toHaveLength(5)
  })
})
