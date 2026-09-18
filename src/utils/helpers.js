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

export function formatDate(date) {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatRelativeDate(date) {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  const now = new Date()
  const diffMs = now - d
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return formatDate(date)
}

export function timeAgo(date) {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  const now = new Date()
  const diffMs = now - d
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} minutes ago`
  if (diffHours < 24) return `${diffHours} hours ago`
  if (diffDays === 1) return 'Yesterday'
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
