/**
 * Deleting the family: asking for it, and taking that back.
 *
 * Both go through Cloud Functions (functions/familyDeletion.js), which let the
 * family's owner do it and nobody else. The date lives on the family document
 * as `deletion.deleteAfter`, where every member can read it and no client can
 * write it (firestore.rules). Nothing is deleted before that date; a daily run
 * on the server does it afterwards.
 */
import { callFunction } from './callable'

/** Mirrors DELETION_GRACE_DAYS in functions/familyDeletion.js. */
export const DELETION_GRACE_DAYS = 14

/** @returns {Promise<{ deleteAfter: string }>} */
export const requestFamilyDeletion = (familyId) => callFunction('requestFamilyDeletion', { familyId })

export const cancelFamilyDeletion = (familyId) => callFunction('cancelFamilyDeletion', { familyId })

/** The day a family document says it is deleted on, or null. */
export function scheduledDeletion(family) {
  const date = family?.deletion?.deleteAfter?.toDate?.()
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null
}
