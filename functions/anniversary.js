/**
 * Date maths for the anniversary reminder, kept free of firebase-admin so the
 * app's test suite can import it directly.
 *
 * The scheduler runs in UTC, the families do not. "Three years ago today" has
 * to mean a calendar day in the family's timezone, or a memory dated at
 * midnight lands in the wrong window twice a year.
 */

export const ANNIVERSARY_YEARS_AGO = 3

/**
 * How far `timeZone` is ahead of UTC at the given instant, in milliseconds.
 * Formats the instant as wall-clock time in the zone and compares it with the
 * same wall clock read as UTC.
 */
export function zoneOffsetMs(utcMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))

  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  // 'en-US' with hour12: false renders midnight as 24, which Date.UTC would
  // roll into the next day.
  const hour = p.hour === '24' ? 0 : Number(p.hour)
  // formatToParts has no millisecond field, so the milliseconds of the input
  // are carried over — without them every offset comes out up to 999ms short.
  const ms = ((utcMs % 1000) + 1000) % 1000
  const asUtc =
    Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), hour, Number(p.minute), Number(p.second)) + ms
  return asUtc - utcMs
}

/** The UTC instant of a wall-clock time in `timeZone`. */
function zonedTimeToUtc(y, m, d, hh, mm, ss, ms, timeZone) {
  const wall = Date.UTC(y, m - 1, d, hh, mm, ss, ms)
  // Two passes: the first uses the offset at the wrong instant, which is only
  // wrong on the two days a year when the offset changes mid-day. The second
  // reads the offset at (almost) the right instant and settles it.
  let utc = wall - zoneOffsetMs(wall, timeZone)
  utc = wall - zoneOffsetMs(utc, timeZone)
  return new Date(utc)
}

/** The calendar date in `timeZone` at the given instant. */
function zonedDateParts(now, timeZone) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  )
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day) }
}

/**
 * The inclusive [start, end] instants of the same calendar day `yearsAgo`
 * years before `now`, as that day ran in `timeZone`.
 *
 * Feb 29 has no counterpart in a non-leap year; JS rolls it to Mar 1, which is
 * the same thing the old client-side check did.
 */
export function anniversaryWindow(now, timeZone, yearsAgo = ANNIVERSARY_YEARS_AGO) {
  const { year, month, day } = zonedDateParts(now, timeZone)
  const targetYear = year - yearsAgo
  return {
    start: zonedTimeToUtc(targetYear, month, day, 0, 0, 0, 0, timeZone),
    end: zonedTimeToUtc(targetYear, month, day, 23, 59, 59, 999, timeZone),
    year: targetYear,
  }
}

/**
 * How many memories each family has in `window`, from one query.
 *
 * This used to be one query per family, one after another: every family cost
 * at least one billed read a day even when nothing matched, and the run grew
 * with the number of families. A single range on `date` — which the automatic
 * single-field index serves — reads only the memories that match, and
 * `select('familyId')` brings back nothing else of them.
 *
 * `date` and `familyId` are the two fields that are never encrypted; the
 * server can only do this because of that.
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {{ start: Date, end: Date }} window  inclusive at both ends
 * @returns {Promise<Map<string, number>>} familyId → count, families with none omitted
 */
export async function countAnniversaryMemories(db, window) {
  const snapshot = await db
    .collection('memories')
    .where('date', '>=', window.start)
    .where('date', '<=', window.end)
    .select('familyId')
    .get()
  const counts = new Map()
  for (const doc of snapshot.docs) {
    const familyId = doc.get('familyId')
    if (typeof familyId === 'string' && familyId) counts.set(familyId, (counts.get(familyId) ?? 0) + 1)
  }
  return counts
}
