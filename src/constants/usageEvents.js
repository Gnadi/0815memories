// Shape of a usage event — the app's own, first-party record of what is used
// and where people get stuck during the friends-and-family phase.
//
// These lists are mirrored by `match /usageEvents/{eventId}` in
// firestore.rules. The service is only the first of the two checks, and the
// rules are the one that counts: change them together (a test compares the
// event names).
//
// What an event never holds: text, titles, names, file names, ids of content,
// keys, a user id. Only a family id, the role, a name from the list below and
// up to three short labels. See docs/usage-tracking.md.

export const USAGE_EVENTS = [
  'session_started',
  'family_created',
  'invite_created',
  'viewer_password_set',
  'viewer_login_succeeded',
  'item_created',
  'feature_opened',
  'upload_rejected',
  'upload_failed',
  'error_shown',
  'push_permission',
  'pwa_installed',
  'feedback_sent',
]

// The labels an event may carry. `tries` is a count, kept as text like the
// rest so a label is always a short string.
export const USAGE_PROP_KEYS = ['feature', 'kind', 'reason', 'area', 'result', 'tries']

export const USAGE_PROPS_MAX = 3
export const USAGE_PROP_VALUE_MAX = 40
export const USAGE_SESSION_MAX = 32
export const USAGE_LANGUAGE_MAX = 16

// Events are deleted by a Firestore TTL policy on `expireAt`. The rules accept
// a window around this rather than an exact value, because the client cannot
// know the server's clock.
export const USAGE_RETENTION_DAYS = 90

// A label is a slug, deliberately. Anything that could be a sentence, a title
// or a name does not fit, so a call site that passes content by mistake is
// refused here instead of being stored.
const LABEL = /^[a-z0-9_-]{1,40}$/

/**
 * Validate an event and its labels. Pure — no Firestore, no clock — so the
 * decisions the rules also make are testable on their own.
 *
 * Returns `{ ok: true, value }` with `{ name, props }`, or `{ ok: false, error }`.
 */
export function buildUsageEvent(name, props = {}) {
  if (!USAGE_EVENTS.includes(name)) return { ok: false, error: `unknown event: ${name}` }

  const entries = Object.entries(props ?? {}).filter(([, v]) => v !== undefined && v !== null)
  if (entries.length > USAGE_PROPS_MAX) return { ok: false, error: 'too many labels' }

  const clean = {}
  for (const [key, raw] of entries) {
    if (!USAGE_PROP_KEYS.includes(key)) return { ok: false, error: `unknown label: ${key}` }
    const value = String(raw)
    if (!LABEL.test(value)) return { ok: false, error: `label ${key} is not a short slug` }
    clean[key] = value
  }
  return { ok: true, value: { name, props: clean } }
}

// Which feature a page belongs to, for `feature_opened`. Route patterns, never
// the path itself: a path carries ids of content. Order matters, first match
// wins. Pages that are not a feature (settings, legal, login) are not listed.
const FEATURE_ROUTES = [
  [/^\/home$/, 'feed'],
  [/^\/memory\//, 'feed'],
  [/^\/moments/, 'moments'],
  [/^\/best-of\//, 'best_of'],
  [/^\/timeline/, 'timeline'],
  [/^\/journal\/[^/]+\/sky/, 'birth_sky'],
  [/^\/journal/, 'journal'],
  [/^\/blackbox/, 'vault'],
  [/^\/recipes/, 'recipes'],
  [/^\/scrapbook/, 'scrapbook'],
  [/^\/collage/, 'collages'],
  [/^\/highlight/, 'highlights'],
  [/^\/our-year/, 'our_year'],
  [/^\/settings\/login-designer/, 'login_designer'],
  [/^\/settings/, 'settings'],
]

/** The feature a pathname belongs to, or null. */
export function featureForPath(pathname) {
  for (const [pattern, feature] of FEATURE_ROUTES) {
    if (pattern.test(pathname)) return feature
  }
  return null
}
