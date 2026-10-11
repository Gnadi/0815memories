/**
 * Returns true if `date` falls on the same month and day as `referenceDate`
 * (year-independent). Handles Firestore Timestamps, JS Dates, and date strings.
 *
 * @param {Date|{toDate:()=>Date}|string} date
 * @param {Date} [referenceDate]
 */
export function isOnThisDay(date, referenceDate = new Date()) {
  const d = date?.toDate ? date.toDate() : new Date(date)
  return d.getMonth() === referenceDate.getMonth() && d.getDate() === referenceDate.getDate()
}

// The three formatters below take the reader's language as `locale` (that is,
// i18n.language). Components get them through hooks/useDateFormat.js, which
// passes it in; they used to format in 'en-US' for everyone.

const toDate = (date) => (date?.toDate ? date.toDate() : new Date(date))

// Intl writes "yesterday" and "vor 3 Tagen" for the middle of a sentence; these
// labels stand on their own.
const capitalize = (text, locale) => text.charAt(0).toLocaleUpperCase(locale) + text.slice(1)

// Calendar days, not elapsed ones: a moment from 23:00 is "yesterday" at 08:00
// the next morning, though it is not 24 hours old. Rounding absorbs the 23- and
// 25-hour days of the clock changes.
function calendarDaysBetween(earlier, later) {
  const start = new Date(earlier.getFullYear(), earlier.getMonth(), earlier.getDate())
  const end = new Date(later.getFullYear(), later.getMonth(), later.getDate())
  return Math.round((end - start) / 86400000)
}

/** "October 10, 2026", "10. Oktober 2026". */
export function formatDate(date, locale) {
  if (!date) return ''
  return toDate(date).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
}

/** "Today", "Yesterday", "3 days ago" within a week; the date after that. */
export function formatRelativeDate(date, locale, { now = new Date() } = {}) {
  if (!date) return ''
  const days = calendarDaysBetween(toDate(date), now)
  if (days < 0 || days >= 7) return formatDate(date, locale)
  return capitalize(new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-days, 'day'), locale)
}

/**
 * "5 minutes ago", "3 hours ago", "Yesterday"; the date after that. Under a
 * minute it is `justNow`, a translated label, since Intl only has "now".
 */
export function timeAgo(date, locale, { now = new Date(), justNow } = {}) {
  if (!date) return ''
  const d = toDate(date)
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const minutes = Math.floor((now - d) / 60000)
  if (minutes < 1) return justNow ?? capitalize(relative.format(0, 'second'), locale)
  if (minutes < 60) return capitalize(relative.format(-minutes, 'minute'), locale)
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return capitalize(relative.format(-hours, 'hour'), locale)
  if (calendarDaysBetween(d, now) === 1) return capitalize(relative.format(-1, 'day'), locale)
  return formatDate(d, locale)
}

// Characters no common filesystem takes. Control characters go too — hence the
// comparison rather than a character class, which lint reads as a typo.
const UNSAFE_FILENAME_CHARS = /[\\/:*?"<>|]/
const isUnsafeFilenameChar = (char) => char < ' ' || UNSAFE_FILENAME_CHARS.test(char)
const MAX_EXPORT_NAME_LENGTH = 60

/**
 * A filename for a download: the thing's own name, cleaned up for a filesystem,
 * followed by the minute it was exported.
 *
 * The timestamp is not decoration. Scrapbooks are all called "My Scrapbook"
 * until someone renames them, so a filename built from the title alone hands
 * every book the same one and each download quietly lands on top of the last.
 *
 * @param {string} name
 * @param {string} extension  without the dot, e.g. 'pdf'
 * @param {{ at?: Date, fallback?: string }} [options]
 */
export function exportFileName(name, extension, { at = new Date(), fallback = 'Export' } = {}) {
  const cleaned = Array.from(String(name ?? ''), (char) => (isUnsafeFilenameChar(char) ? ' ' : char))
    .join('')
    .replace(/\s+/g, ' ')
    .slice(0, MAX_EXPORT_NAME_LENGTH)
    // Leading dots hide the file on unix; trailing dots and spaces are dropped
    // on Windows.
    .replace(/^[.\s]+|[.\s]+$/g, '')
  const pad = (value) => String(value).padStart(2, '0')
  const stamp = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
    + `-${pad(at.getHours())}${pad(at.getMinutes())}`
  return `${cleaned || fallback}-${stamp}.${extension}`
}
