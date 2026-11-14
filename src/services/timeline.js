import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getCountFromServer,
  Timestamp,
} from '../config/firestore'
import { db } from '../config/firebase'
import { decryptMemory } from './memories'
import { subscribeDecrypted } from './decrypted'
import { devWarn } from '../utils/devLog'

/**
 * The Smart Timeline's data.
 *
 * It used to be the home feed's query — the newest 50 memories — filtered in
 * the browser. For a family with more than 50, everything older was simply
 * absent: no chip for its year, no way to view it, and "On this day" only
 * searched those 50, while the anniversary push that links there counts all of
 * them. Each view now asks Firestore for exactly its own range:
 *
 *   - the years: the newest and oldest date, then one count per year between;
 *   - a year: that year's memories, live;
 *   - "On this day": today's month and day in each of those years, once.
 *
 * `date` and `familyId` are the two fields that are never encrypted, which is
 * what makes range queries possible at all.
 */

// Years counted in one parallel round, newest first. Older ones are found one
// at a time instead (fetchTimelineYears), so a single memory with a mistyped
// year — 0202 for 2020 — no longer costs a count for every year in between:
// that was 1,824 queries, and a timeline that never finished loading.
export const COUNTED_YEARS = 40

/**
 * A local date. `new Date(y, m, d)` reads a year below 100 as 1900 + y, and a
 * mistyped year is exactly how a memory ends up that far back.
 */
function localDate(year, month, day) {
  const date = new Date(2000, 0, 1)
  // All three at once, so a day past the month's end rolls over within `year`
  // (31 December + 1 is 1 January of the next year, 29 February of a common
  // year is 1 March).
  date.setFullYear(year, month, day)
  return date
}

/** [start, end) of a calendar year, local time — what getFullYear() groups by. */
export function yearRange(year) {
  return [localDate(year, 0, 1), localDate(year + 1, 0, 1)]
}

/**
 * [start, end) of `reference`'s month and day in each of `years`, local time —
 * the same test isOnThisDay() applies. A year without that day (29 February
 * outside a leap year) has no range, rather than borrowing 1 March.
 */
export function onThisDayRanges(reference, years) {
  const month = reference.getMonth()
  const day = reference.getDate()
  return years
    .map((year) => ({ year, start: localDate(year, month, day), end: localDate(year, month, day + 1) }))
    .filter(({ start }) => start.getMonth() === month)
}

const familyMemories = (database, familyId) => [
  collection(database, 'memories'),
  where('familyId', '==', familyId),
]

// Ordered newest first even where the order does not matter (a count): that
// is the shape of the (familyId ASC, date DESC) index the feed already uses.
function rangeQuery(database, familyId, start, end) {
  return query(
    ...familyMemories(database, familyId),
    where('date', '>=', Timestamp.fromDate(start)),
    where('date', '<', Timestamp.fromDate(end)),
    orderBy('date', 'desc'),
  )
}

const yearOf = (snapshot) => snapshot.docs[0].data().date.toDate().getFullYear()

/** Every year this family has a memory in, newest first. */
export async function fetchTimelineYears(database, familyId) {
  const newest = await getDocs(query(...familyMemories(database, familyId), orderBy('date', 'desc'), limit(1)))
  if (newest.empty) return []
  const last = yearOf(newest)

  // The oldest memory keeps the counting to years that can have any. It is
  // unknown only while the (familyId, date ASC) index is still building after a
  // deploy; the walk below then finds the older years by itself.
  let first = null
  try {
    const oldest = await getDocs(query(...familyMemories(database, familyId), orderBy('date', 'asc'), limit(1)))
    first = yearOf(oldest)
  } catch (err) {
    devWarn('Oldest memory lookup failed; walking back year by year instead:', err?.code)
  }

  const floor = Math.max(first ?? -Infinity, last - COUNTED_YEARS + 1)
  const counted = []
  for (let year = last; year >= floor; year--) counted.push(year)
  const counts = await Promise.all(
    counted.map((year) => getCountFromServer(rangeQuery(database, familyId, ...yearRange(year)))),
  )
  const years = counted.filter((_, i) => counts[i].data().count > 0)

  // Anything older, one year at a time: the newest memory before the oldest
  // year looked at so far. One read per year that has memories, however far
  // apart they are.
  for (let before = floor; first === null || before > first; ) {
    const older = await getDocs(query(
      ...familyMemories(database, familyId),
      where('date', '<', Timestamp.fromDate(yearRange(before)[0])),
      orderBy('date', 'desc'),
      limit(1),
    ))
    if (older.empty) break
    before = yearOf(older)
    years.push(before)
  }
  return years
}

/** The query for one year's memories, newest first. */
export function yearQuery(database, familyId, year) {
  return rangeQuery(database, familyId, ...yearRange(year))
}

/** Memories on `reference`'s month and day in any of `years`, newest first, undecrypted. */
export async function fetchOnThisDay(database, familyId, years, reference = new Date()) {
  const snapshots = await Promise.all(
    onThisDayRanges(reference, years).map(({ start, end }) =>
      getDocs(rangeQuery(database, familyId, start, end)),
    ),
  )
  return snapshots
    .flatMap((snapshot) => snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
    .sort((a, b) => b.date.toMillis() - a.date.toMillis())
}

/** One year's memories, newest first, live and decrypted. */
export function subscribeYearMemories(familyId, year, key, onData, onError) {
  return subscribeDecrypted(
    yearQuery(db, familyId, year),
    (docs) => Promise.all(docs.map((d) => decryptMemory(key, d))),
    onData,
    onError,
  )
}

/** fetchOnThisDay, decrypted. */
export async function getOnThisDayMemories(familyId, years, key, reference = new Date()) {
  const docs = await fetchOnThisDay(db, familyId, years, reference)
  return Promise.all(docs.map((d) => decryptMemory(key, d)))
}
