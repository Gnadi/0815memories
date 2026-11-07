/**
 * The advent calendar's reading (utils/advent.js): the memories and moments
 * its doors are chosen from. It writes nothing.
 *
 * Two kinds of query, on the (familyId, date DESC) index the feed already
 * uses — `date` and `familyId` are never encrypted, which is what lets
 * Firestore hand over a range at all:
 *
 *   - the newest entries from before the first door, the general pool;
 *   - the Advent weeks of the last few years, so a door can find its own day
 *     even in a family that has posted far more than the pool holds since.
 */
import { collection, getDocs, limit, orderBy, query, Timestamp, where } from '../config/firestore'
import { db } from '../config/firebase'
import { decryptMemory } from './memories'
import { decryptMoment } from './moments'
import { doorOpensAt } from '../utils/advent'

// Enough to fill 24 doors many times over, without reading a family's whole
// history every time the calendar is opened.
export const POOL_SIZE = 120
// How many Advents back a door looks for its own day, and how much of each.
export const PAST_ADVENTS = 5
const PAST_ADVENT_SIZE = 40

const COLLECTIONS = ['memories', 'moments']

/** The newest `size` entries of `collectionName` dated before `before`. */
export function entriesBeforeQuery(database, collectionName, familyId, before, size = POOL_SIZE) {
  return query(
    collection(database, collectionName),
    where('familyId', '==', familyId),
    where('date', '<', Timestamp.fromDate(before)),
    orderBy('date', 'desc'),
    limit(size),
  )
}

/** 1 to 24 December of `year` — the days that have a door. */
export function adventRangeQuery(database, collectionName, familyId, year, size = PAST_ADVENT_SIZE) {
  return query(
    collection(database, collectionName),
    where('familyId', '==', familyId),
    where('date', '>=', Timestamp.fromDate(doorOpensAt(year, 1))),
    where('date', '<', Timestamp.fromDate(doorOpensAt(year, 25))),
    orderBy('date', 'desc'),
    limit(size),
  )
}

/**
 * Everything the calendar of `year` is chosen from, undecrypted:
 * `{ memories, moments }`. A past Advent that cannot be read leaves the
 * calendar without it, not without a calendar.
 */
export async function fetchAdventEntries(database, familyId, year) {
  const read = async (collectionName) => {
    const queries = [
      entriesBeforeQuery(database, collectionName, familyId, doorOpensAt(year, 1)),
      ...Array.from({ length: PAST_ADVENTS }, (_, i) => adventRangeQuery(database, collectionName, familyId, year - 1 - i)),
    ]
    const [pool, ...past] = await Promise.all(queries.map((q, i) =>
      i === 0 ? getDocs(q) : getDocs(q).catch(() => null),
    ))
    // Last year's Advent is usually in the pool as well; each entry once, so
    // it is decrypted once.
    const byId = new Map()
    for (const snapshot of [pool, ...past].filter(Boolean)) {
      for (const d of snapshot.docs) byId.set(d.id, { id: d.id, ...d.data() })
    }
    return [...byId.values()]
  }
  const [memories, moments] = await Promise.all(COLLECTIONS.map(read))
  return { memories, moments }
}

/** fetchAdventEntries, decrypted as the feed decrypts them. */
export async function getAdventEntries(familyId, key, year) {
  const { memories, moments } = await fetchAdventEntries(db, familyId, year)
  return {
    memories: await Promise.all(memories.map((d) => decryptMemory(key, d))),
    moments: await Promise.all(moments.map((d) => decryptMoment(key, d))),
  }
}
