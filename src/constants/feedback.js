// Shape of an app-feedback document.
//
// These limits are mirrored by `match /feedback/{feedbackId}` in
// firestore.rules — the form is only the first of the two checks, and the rules
// are the one that counts. Change them together.

export const FEEDBACK_CATEGORIES = ['bug', 'idea', 'praise', 'other']

export const DEFAULT_FEEDBACK_CATEGORY = 'other'

// Long enough for a detailed bug report, short enough that the collection
// cannot be used as anonymous blob storage.
export const FEEDBACK_MESSAGE_MAX = 2000
export const FEEDBACK_CONTACT_MAX = 200
// Stored so a bug report says which browser it came from; truncated because the
// field is attacker-controlled in exactly the same way as the message.
export const FEEDBACK_USER_AGENT_MAX = 300
// The route the person was on when they opened the form.
export const FEEDBACK_PATH_MAX = 200

// 0 means "no rating given" — the stars are optional, a written note is not.
export const FEEDBACK_RATING_MIN = 1
export const FEEDBACK_RATING_MAX = 5

/**
 * Validate and normalize what the form collected.
 *
 * Returns `{ ok: true, value }` with a document ready to write, or
 * `{ ok: false, error }` naming the first problem as a translation key. Pure —
 * no Firestore, no clock — so the rules-shaped decisions are testable on their
 * own.
 */
export function buildFeedbackDocument({
  message,
  category,
  rating,
  contact,
  path,
  language,
  userAgent,
} = {}) {
  const text = typeof message === 'string' ? message.trim() : ''
  if (!text) return { ok: false, error: 'errors.messageRequired' }
  if (text.length > FEEDBACK_MESSAGE_MAX) return { ok: false, error: 'errors.messageTooLong' }

  const contactText = typeof contact === 'string' ? contact.trim() : ''
  if (contactText.length > FEEDBACK_CONTACT_MAX) return { ok: false, error: 'errors.contactTooLong' }

  const value = {
    message: text,
    category: FEEDBACK_CATEGORIES.includes(category) ? category : DEFAULT_FEEDBACK_CATEGORY,
    // Absent rather than 0 when nobody touched the stars, so a stored rating
    // always means someone chose one.
    rating: isValidRating(rating) ? rating : null,
    contact: contactText,
    // Trimmed to the same limits the rules enforce: these come from the
    // browser, and an oversized one would fail the write with a permission
    // error that reads like the feedback itself was rejected.
    path: truncate(path, FEEDBACK_PATH_MAX),
    language: truncate(language, 16),
    userAgent: truncate(userAgent, FEEDBACK_USER_AGENT_MAX),
  }
  return { ok: true, value }
}

function isValidRating(rating) {
  return Number.isInteger(rating)
    && rating >= FEEDBACK_RATING_MIN
    && rating <= FEEDBACK_RATING_MAX
}

function truncate(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : ''
}
