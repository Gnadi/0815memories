/**
 * The monthly best-of push, kept free of firebase-admin so the app's test
 * suite can import it directly.
 *
 * The best-of itself is put together in the browser (src/utils/bestOf.js),
 * because it is made of photos only a family member can decrypt. What the
 * server can do is know that a month had photos at all: `date`, `familyId` and
 * the media URLs are not encrypted, so it can count them — never look at them —
 * and tell the family on the 1st that last month's best-of is waiting. Opening
 * the notification is what makes the app put it together, if no admin's device
 * has already.
 */
import { zonedDateParts, zonedTimeToUtc } from './anniversary.js'
import { normalizeLang } from './push.js'

/**
 * Fewer photos and clips than this, and the family is not told. Mirrored by
 * MIN_BEST_OF_MEDIA in src/utils/bestOf.js, which refuses to make one below it;
 * src/__tests__/bestOf.test.js keeps the two equal.
 */
export const BEST_OF_MIN_MEDIA = 6

const pad = (n) => String(n).padStart(2, '0')

/**
 * The month before the one `now` falls in, as the family's calendar has it:
 * [start, end) as instants, and its 'YYYY-MM' name — the same name the app
 * gives it, which the notification's link carries.
 */
export function previousMonthWindow(now, timeZone) {
  const { year, month } = zonedDateParts(now, timeZone)
  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  return {
    start: zonedTimeToUtc(prevYear, prevMonth, 1, 0, 0, 0, 0, timeZone),
    end: zonedTimeToUtc(year, month, 1, 0, 0, 0, 0, timeZone),
    year: prevYear,
    // 1-based, as people write it.
    month: prevMonth,
    key: `${prevYear}-${pad(prevMonth)}`,
  }
}

function mediaOf(doc) {
  const images = doc.get('images')
  const videos = doc.get('videos')
  const imageCount = Array.isArray(images) && images.length > 0 ? images.length : doc.get('imageUrl') ? 1 : 0
  return imageCount + (Array.isArray(videos) ? videos.length : 0)
}

/**
 * How many photos and clips each family posted in `window`, memories and
 * moments together, from one query per collection.
 *
 * Like countAnniversaryMemories, a range on `date` that the automatic
 * single-field index serves, reading only the month's documents and only the
 * fields that are counted. The URLs are read to be counted, nothing more.
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {{ start: Date, end: Date }} window  start inclusive, end exclusive
 * @returns {Promise<Map<string, number>>} familyId → media count, families with none omitted
 */
export async function countMonthMedia(db, window) {
  const counts = new Map()
  for (const collection of ['memories', 'moments']) {
    const snapshot = await db
      .collection(collection)
      .where('date', '>=', window.start)
      .where('date', '<', window.end)
      .select('familyId', 'images', 'imageUrl', 'videos')
      .get()
    for (const doc of snapshot.docs) {
      const familyId = doc.get('familyId')
      const media = mediaOf(doc)
      if (typeof familyId !== 'string' || !familyId || media === 0) continue
      counts.set(familyId, (counts.get(familyId) ?? 0) + media)
    }
  }
  return counts
}

/** The families worth telling, in the order they were counted. */
export function familiesWithBestOf(counts) {
  return [...counts].filter(([, media]) => media >= BEST_OF_MIN_MEDIA).map(([familyId]) => familyId)
}

/** Where the notification leads: the viewer, which makes the best-of if need be. */
export const bestOfUrl = (key) => `/best-of/${key}`

/** The notification. The month's name is the only thing in it that varies. */
export function bestOfCopy(lang, window) {
  const en = normalizeLang(lang) === 'en'
  // Mid-month at noon UTC, so no time zone can move it into a neighbour.
  const monthName = new Intl.DateTimeFormat(en ? 'en-GB' : 'de-DE', { month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(window.year, window.month - 1, 15, 12)))
  if (en) {
    return {
      title: `✨ Best of ${monthName}`,
      body: `Your ${monthName} in highlights is ready — the best photos, clips and a few awards.`,
    }
  }
  return {
    title: `✨ Best of ${monthName}`,
    body: `Euer ${monthName} ist fertig — die schönsten Fotos, Clips und ein paar Auszeichnungen.`,
  }
}
