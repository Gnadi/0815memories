/**
 * The life of a print order, and the one question that matters for privacy:
 * when can the plaintext print file go?
 *
 * That file is the only unencrypted family content Kaydo stores, so it should
 * exist for exactly as long as a press needs it and not a day longer. Deciding
 * that from a status string is easy to get subtly wrong in three places at
 * once, so it is decided here and only here — the UI, the cleanup pass and the
 * scheduled function all ask the same function.
 */

export const STATUS = {
  /** The order record exists; the network has not accepted it yet. */
  PLACING: 'placing',
  PLACED: 'placed',
  IN_PRODUCTION: 'inProduction',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
}

/** Nothing more will happen to an order in one of these states. */
const FINAL = [STATUS.DELIVERED, STATUS.FAILED, STATUS.CANCELLED]

/**
 * States in which the press is demonstrably done reading the file: it has
 * either printed it or will never print it.
 *
 * `shipped` counts — a book in the post has been printed — and so does every
 * failure, because a file nobody will fetch is pure exposure.
 */
const FILE_NO_LONGER_NEEDED = [STATUS.SHIPPED, STATUS.DELIVERED, STATUS.FAILED, STATUS.CANCELLED]

/**
 * How long a print file may sit around before it is deleted regardless of what
 * the order says.
 *
 * The backstop for the case that actually happens: an order whose status never
 * advances because the provider went quiet, nobody opened the app, or a webhook
 * was never wired. Long enough that a real production run is never cut short,
 * short enough that "indefinitely" is not the answer.
 */
export const PRINT_FILE_MAX_AGE_DAYS = 30

export function isFinalStatus(status) {
  return FINAL.includes(status)
}

export function toMillis(value) {
  if (!value) return null
  if (typeof value === 'number') return value
  if (value instanceof Date) return value.getTime()
  // Firestore Timestamp, from either the client or admin SDK.
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.seconds === 'number') return value.seconds * 1000
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Whether this order's print file should be deleted now.
 *
 * Returns a reason rather than a bare boolean, because the two reasons mean
 * different things when they show up in a log: `done` is the system working,
 * `expired` is the system having lost track of an order and cleaning up anyway.
 */
export function printFileRelease(order, { now = Date.now(), maxAgeDays = PRINT_FILE_MAX_AGE_DAYS } = {}) {
  if (!order?.printFilePath) return { release: false, reason: 'noFile' }
  if (order.printFileDeletedAt) return { release: false, reason: 'alreadyDeleted' }

  if (FILE_NO_LONGER_NEEDED.includes(order.status)) {
    return { release: true, reason: 'done' }
  }

  const createdAt = toMillis(order.createdAt)
  if (createdAt !== null && now - createdAt > maxAgeDays * 24 * 60 * 60 * 1000) {
    return { release: true, reason: 'expired' }
  }

  return { release: false, reason: 'stillNeeded' }
}

/**
 * Map what the print network calls a state onto what we call it.
 *
 * UNVERIFIED: Peecho's own status vocabulary is part of the API reference that
 * was not reachable when this was written. The matching is done on substrings
 * and lower case so that near-misses still land somewhere sensible, and
 * anything unrecognised keeps the status we already had rather than inventing
 * a transition — a wrong "shipped" would delete the print file early.
 */
export function mapProviderStatus(providerStatus, currentStatus = STATUS.PLACED) {
  const value = String(providerStatus || '').toLowerCase()
  if (!value) return currentStatus

  if (/(cancel|refund)/.test(value)) return STATUS.CANCELLED
  if (/(fail|error|reject)/.test(value)) return STATUS.FAILED
  if (/(deliver)/.test(value)) return STATUS.DELIVERED
  if (/(ship|dispatch|sent|transit)/.test(value)) return STATUS.SHIPPED
  if (/(print|produc|manufactur|progress)/.test(value)) return STATUS.IN_PRODUCTION
  if (/(receiv|accept|paid|new|pending|submit)/.test(value)) return STATUS.PLACED

  return currentStatus
}
