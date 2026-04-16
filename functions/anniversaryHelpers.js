/**
 * Pure helper for the anniversary notification Cloud Function.
 * No Firebase imports — keeps the logic unit-testable without the SDK.
 */

/**
 * Groups Firestore-like snapshot docs by familyId and builds the notification
 * payloads for the anniversary reminder.
 *
 * @param {Array<{data(): {familyId?: string}}>} docs  - Firestore document snapshots
 * @param {Date} threeYearsAgoDate                     - The exact anniversary date
 * @returns {{ familyId: string, count: number, year: number }[]}
 */
export function buildAnniversaryPayloads(docs, threeYearsAgoDate) {
  const byFamily = {}
  for (const doc of docs) {
    const { familyId } = doc.data()
    if (!familyId) continue
    byFamily[familyId] = (byFamily[familyId] || 0) + 1
  }
  const year = threeYearsAgoDate.getFullYear()
  return Object.entries(byFamily).map(([familyId, count]) => ({ familyId, count, year }))
}
