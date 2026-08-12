import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore'

// Local-timezone YYYY-MM-DD key. Used as the daily lock value.
export function todayDateKey(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Returns the inclusive [start, end] of the same calendar day three years ago,
// in local timezone — matching the original cron's window semantics.
export function threeYearsAgoWindow(now = new Date()) {
  const start = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { start, end, year: start.getFullYear() }
}

/**
 * Counts memories for one family whose `date` falls on the same calendar day
 * three years ago. Returns null if none.
 *
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} familyId
 * @param {Date} [now]   — injectable for tests
 * @returns {Promise<{ count: number, year: number } | null>}
 */
export async function countAnniversaryMemories(db, familyId, now = new Date()) {
  const { start, end, year } = threeYearsAgoWindow(now)
  const q = query(
    collection(db, 'memories'),
    where('familyId', '==', familyId),
    where('date', '>=', Timestamp.fromDate(start)),
    where('date', '<=', Timestamp.fromDate(end)),
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  return { count: snap.size, year }
}
