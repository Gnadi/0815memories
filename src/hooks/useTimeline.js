import { useState, useEffect } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  getCountFromServer,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { decryptMemory, decryptMoment } from './useMemories'
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
 *
 * Moments share the timeline: every range above is asked of both collections
 * and the answers are merged by date. A moment comes back marked
 * `kind: 'moment'`, because it opens in the story viewer rather than on a
 * detail page.
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

const familyMemories = (database, familyId, source = 'memories') => [
  collection(database, source),
  where('familyId', '==', familyId),
]

// Ordered newest first even where the order does not matter (a count): that
// is the shape of the (familyId ASC, date DESC) index the feed already uses.
function rangeQuery(database, familyId, start, end, source = 'memories') {
  return query(
    ...familyMemories(database, familyId, source),
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

/**
 * Every year this family has a moment in, newest first.
 *
 * Walked one read per year that has moments, rather than counted: moments only
 * have the (familyId, date DESC) index, and a family has far fewer of them.
 */
export async function fetchMomentYears(database, familyId) {
  const years = []
  let before = null
  for (;;) {
    const older = await getDocs(query(
      ...familyMemories(database, familyId, 'moments'),
      ...(before === null ? [] : [where('date', '<', Timestamp.fromDate(yearRange(before)[0]))]),
      orderBy('date', 'desc'),
      limit(1),
    ))
    if (older.empty) break
    before = yearOf(older)
    years.push(before)
  }
  return years
}

/** The query for one year's memories (or moments), newest first. */
export function yearQuery(database, familyId, year, source = 'memories') {
  return rangeQuery(database, familyId, ...yearRange(year), source)
}

/** Entries on `reference`'s month and day in any of `years`, newest first, undecrypted. */
export async function fetchOnThisDay(database, familyId, years, reference = new Date(), source = 'memories') {
  const snapshots = await Promise.all(
    onThisDayRanges(reference, years).map(({ start, end }) =>
      getDocs(rangeQuery(database, familyId, start, end, source)),
    ),
  )
  return snapshots
    .flatMap((snapshot) => snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
    .sort((a, b) => b.date.toMillis() - a.date.toMillis())
}

const asMoment = (moment) => ({ ...moment, kind: 'moment' })

// A moment just posted from this device has no server date yet; it is the newest.
const millis = (entry) => entry.date?.toMillis?.() ?? Date.now()
const newestFirst = (a, b) => millis(b) - millis(a)

/**
 * @param {{ year: number|null, onThisDay: boolean }} view
 * @returns {{ years: number[], memories: object[], loading: boolean }} `memories`
 *   holds the moments too, each marked `kind: 'moment'`.
 */
export function useTimeline(familyId, encryptionKey, { year, onThisDay }) {
  const [years, setYears] = useState({ familyId: null, list: [] })
  const [view, setView] = useState({ key: null, memories: [] })

  useEffect(() => {
    if (!familyId || !db) return
    let cancelled = false
    // A failing moments lookup must not take the memories' years with it.
    const momentYears = fetchMomentYears(db, familyId).catch((err) => {
      devWarn('Could not list the moment years:', err?.code)
      return []
    })
    Promise.all([fetchTimelineYears(db, familyId), momentYears])
      .then(([memoryList, momentList]) => {
        const list = [...new Set([...memoryList, ...momentList])].sort((a, b) => b - a)
        if (!cancelled) setYears({ familyId, list })
      })
      .catch((err) => {
        devWarn('Could not list the timeline years:', err?.code, err?.message)
        if (!cancelled) setYears({ familyId, list: [] })
      })
    return () => { cancelled = true }
  }, [familyId])

  const yearsReady = years.familyId === familyId
  const today = new Date()
  const dayKey = `${today.getMonth()}-${today.getDate()}`
  const viewKey = !familyId
    ? null
    : onThisDay
      ? yearsReady ? `day:${familyId}:${dayKey}:${years.list.join(',')}` : null
      : year ? `year:${familyId}:${year}` : null

  useEffect(() => {
    if (!viewKey || !db) return
    let cancelled = false
    const deliver = async (memoryDocs, momentDocs) => {
      const [memories, moments] = await Promise.all([
        Promise.all(memoryDocs.map((d) => decryptMemory(encryptionKey, d))),
        Promise.all(momentDocs.map(async (d) => asMoment(await decryptMoment(encryptionKey, d)))),
      ])
      if (!cancelled) setView({ key: viewKey, memories: [...memories, ...moments].sort(newestFirst) })
    }
    const fail = (err) => {
      devWarn('Could not load the timeline:', err?.code, err?.message)
      if (!cancelled) setView({ key: viewKey, memories: [] })
    }

    // Moments are an addition to the timeline: if their query fails, the
    // memories still show.
    const noMoments = (err) => {
      devWarn('Could not load the timeline moments:', err?.code, err?.message)
      return []
    }

    if (onThisDay) {
      Promise.all([
        fetchOnThisDay(db, familyId, years.list),
        fetchOnThisDay(db, familyId, years.list, new Date(), 'moments').catch(noMoments),
      ]).then(([memoryDocs, momentDocs]) => deliver(memoryDocs, momentDocs), fail)
      return () => { cancelled = true }
    }

    // Two live listeners; the page is delivered once both have answered.
    let latest = { memories: null, moments: null }
    const emit = () => {
      if (latest.memories && latest.moments) deliver(latest.memories, latest.moments)
    }
    const docsOf = (snapshot) => snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    const unsubscribeMemories = onSnapshot(
      yearQuery(db, familyId, year),
      (snapshot) => { latest = { ...latest, memories: docsOf(snapshot) }; emit() },
      fail,
    )
    const unsubscribeMoments = onSnapshot(
      yearQuery(db, familyId, year, 'moments'),
      (snapshot) => { latest = { ...latest, moments: docsOf(snapshot) }; emit() },
      (err) => { noMoments(err); latest = { ...latest, moments: [] }; emit() },
    )
    return () => {
      cancelled = true
      unsubscribeMemories()
      unsubscribeMoments()
    }
    // viewKey stands for familyId, year, onThisDay and the years list.
  }, [viewKey, encryptionKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const noMemories = yearsReady && years.list.length === 0
  return {
    years: yearsReady ? years.list : [],
    memories: view.key === viewKey && viewKey ? view.memories : [],
    loading: !!familyId && !noMemories && (!yearsReady || (!!viewKey && view.key !== viewKey) || (!viewKey && !onThisDay && !year)),
  }
}
