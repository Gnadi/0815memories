import i18n from '../i18n'

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

// helpers.js is imported by signed-in screens only, but the i18n module is
// already part of the startup bundle (the public shell imports it statically),
// so reading the language here adds nothing to it.
const currentLocale = () => i18n.language || 'en'

export function formatDate(date) {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString(currentLocale(), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Whole calendar days from `d` to `now`, counted on local dates. Comparing
// elapsed 24h windows made 13 hours ago read "Today" when it was last evening.
// Rounding absorbs the 23h and 25h days around a DST change.
const calendarDaysAgo = (d, now) => {
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate())
  return Math.round((startOf(now) - startOf(d)) / 86400000)
}

// numeric: 'auto' gives "today"/"yesterday" ("heute"/"gestern") for free, so
// the words come from the browser's locale data and need no locale strings.
const relativeFormat = () => new Intl.RelativeTimeFormat(currentLocale(), { numeric: 'auto' })

// The formatter writes "today" and "heute" in lower case; these labels stand
// on their own, so they start with a capital like the words they replace.
const capitalize = (text) => text.charAt(0).toLocaleUpperCase(currentLocale()) + text.slice(1)

export function formatRelativeDate(date) {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  const diffDays = calendarDaysAgo(d, new Date())

  // A future date would read "in 3 days", which is wrong for what these labels
  // describe (when something happened), so it gets the plain date instead.
  if (diffDays < 0 || diffDays >= 7) return formatDate(date)
  return capitalize(relativeFormat().format(-diffDays, 'day'))
}

export function timeAgo(date) {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  const now = new Date()
  const diffMs = now - d
  // A clock a little ahead of the server's can put "now" slightly in the
  // future; only a clearly future date falls back to the plain date.
  if (diffMs < -60000) return formatDate(date)

  const rtf = relativeFormat()
  const diffMins = Math.max(0, Math.floor(diffMs / 60000))
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffMins < 1) return capitalize(rtf.format(0, 'second'))
  if (diffMins < 60) return capitalize(rtf.format(-diffMins, 'minute'))
  if (diffHours < 24) return capitalize(rtf.format(-diffHours, 'hour'))
  if (calendarDaysAgo(d, now) === 1) return capitalize(rtf.format(-1, 'day'))
  return formatDate(date)
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
