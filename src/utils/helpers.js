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
