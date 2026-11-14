/**
 * The advent calendar: 24 doors, one opening each day from 1 to 24 December,
 * each with a memory or a moment from the family's past behind it.
 *
 * Nothing is stored. Which entry is behind which door is worked out on the
 * device from the family's entries from before 1 December, with a random
 * order seeded by the family and the year: every member's device comes to the
 * same calendar, without a document to write — viewers could not write one —
 * and without anything new to encrypt. Entries made during December do not
 * move the doors, because they are not in the pool.
 *
 * A door first gets an entry from its own day in an earlier year — the 6th
 * gets a 6 December, if there is one — and only then any other, photos before
 * text. The 24th gets a featured memory when its own day has nothing.
 */

export const ADVENT_DOORS = 24

// The calendar shows up on the home page a week before the first door, and
// stays until Epiphany, so the last doors can still be looked at after
// Christmas.
const TEASER_FROM_DAY = 24 // 24 November
const SEASON_UNTIL_DAY = 6 // 6 January

/** A Firestore Timestamp, a Date or anything Date takes, as a Date. */
export function toDate(value) {
  if (!value) return null
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * The year whose calendar `now` belongs to: December's own year, and in
 * January still the one before — the doors of the Christmas just gone.
 */
export function adventYear(now = new Date()) {
  return now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
}

/** 00:00 local time on `day` December of `year`: when that door opens. */
export function doorOpensAt(year, day) {
  const date = new Date(2000, 0, 1)
  date.setFullYear(year, 11, day)
  return date
}

export function isDoorOpenable(year, day, now = new Date()) {
  return now >= doorOpensAt(year, day)
}

/** Whether the home page shows the calendar: 24 November to 6 January. */
export function isAdventSeason(now = new Date()) {
  const month = now.getMonth()
  const day = now.getDate()
  return (month === 10 && day >= TEASER_FROM_DAY) || month === 11 || (month === 0 && day <= SEASON_UNTIL_DAY)
}

/** Whole days until the first door, or 0 once it is open. */
export function daysUntilAdvent(now = new Date()) {
  const first = doorOpensAt(adventYear(now), 1)
  if (now >= first) return 0
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((first - today) / 86400000)
}

/**
 * A small, stable pseudo-random generator: the same seed gives the same
 * sequence on every device. Not for anything secret.
 */
export function seededRandom(seed) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let state = h >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seededShuffle(list, random) {
  const result = [...list]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

const hasPhoto = (doc) => !!(doc?.images?.length || doc?.imageUrl)

/**
 * The family's memories and moments as one list of candidates for the
 * calendar of `year`: only what is dated before its first door, each once.
 */
export function adventCandidates({ memories = [], moments = [] }, year) {
  const before = doorOpensAt(year, 1)
  const seen = new Set()
  const result = []
  const add = (type, doc) => {
    const key = `${type}:${doc.id}`
    const date = toDate(doc.date)
    if (seen.has(key) || !date || date >= before) return
    seen.add(key)
    result.push({ key, type, id: doc.id, date, photo: hasPhoto(doc), featured: type === 'memory' && !!doc.featured, doc })
  }
  memories.forEach((doc) => add('memory', doc))
  moments.forEach((doc) => add('moment', doc))
  // Sorted before shuffling: the queries can hand the same entries over in a
  // different order, and the calendar must not depend on that.
  return result.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}

/**
 * The calendar of `year` for `seed` (the family): one door per day,
 * `{ day, entry, onThisDay }`, with `entry` null when the family has fewer
 * entries than doors.
 */
export function assignAdventDoors(candidates, { year, seed }) {
  const random = seededRandom(`${seed}:${year}`)
  const pool = seededShuffle(candidates, random)
  const used = new Set()
  const doors = Array.from({ length: ADVENT_DOORS }, (_, i) => ({ day: i + 1, entry: null, onThisDay: false }))

  const take = (door, predicate, onThisDay = false) => {
    const pick = pool.find((c) => !used.has(c.key) && predicate(c))
    if (!pick) return false
    used.add(pick.key)
    door.entry = pick
    door.onThisDay = onThisDay
    return true
  }

  // Own days first, for every door, so that no other door takes a 6 December
  // before the 6th has had its turn.
  for (const door of doors) {
    const sameDay = (c) => c.date.getMonth() === 11 && c.date.getDate() === door.day
    take(door, (c) => sameDay(c) && c.photo, true) || take(door, sameDay, true)
  }

  // Christmas Eve next: the family's featured memory, if it is still free.
  const eve = doors[ADVENT_DOORS - 1]
  if (!eve.entry) take(eve, (c) => c.featured && c.photo) || take(eve, (c) => c.featured)

  for (const door of doors) {
    if (door.entry) continue
    take(door, (c) => c.photo) || take(door, () => true)
  }
  return doors
}

// Where the two big doors (Saint Nicholas' Day, two cells wide, and Christmas
// Eve, two by two) hang in the order. Early enough that enough small doors
// follow to fill the gaps beside them: placed last, the 24th left half a row
// empty at the bottom of the calendar.
const BIG_DOORS = [[4, 6], [10, ADVENT_DOORS]]

/**
 * Where each door hangs on the calendar: the days in a shuffled order, as on a
 * paper calendar, the same for the whole family.
 */
export function adventLayout({ year, seed }) {
  const big = BIG_DOORS.map(([, day]) => day)
  const small = Array.from({ length: ADVENT_DOORS }, (_, i) => i + 1).filter((day) => !big.includes(day))
  const layout = seededShuffle(small, seededRandom(`layout:${seed}:${year}`))
  for (const [index, day] of BIG_DOORS) layout.splice(index, 0, day)
  return layout
}

/** Whole years between an entry and the day its door opens. */
export function yearsAgo(entryDate, year) {
  return Math.max(0, year - entryDate.getFullYear())
}
