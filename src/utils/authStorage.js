/* Where a signed-in session is remembered.
 *
 * Two stores, one decision made at login. "Stay logged in" (the default) keeps
 * the session in localStorage, so it survives closing the tab, quitting the
 * browser, or swiping the installed PWA away — the browser-side half of
 * Firebase's browserLocalPersistence. Unchecked, the same values go to
 * sessionStorage, which the browser drops when the window closes; that matches
 * browserSessionPersistence, so the Firebase token and the family binding
 * expire together instead of one outliving the other.
 *
 * Reads look in localStorage first and fall back to sessionStorage, so a
 * session written either way is found again on the next visit.
 */

// Everything that makes up a session. Cleared together on logout.
//
// 'fh_viewer' is no longer written: a viewer now holds a real Firebase session
// and their role comes from the ID token. It stays on this list so the flag is
// cleared out of browsers that still carry one from an older version.
const SESSION_KEYS = ['fh_familyId', 'fh_viewer', 'fh_cardStyle']

// Marker for "this login was session-only". Lives in sessionStorage itself, so
// it disappears with the window exactly like the session it describes.
const PERSIST_KEY = 'fh_persist'

// Storage throws in Safari private mode and when a browser blocks site data;
// a session that cannot be remembered is worth less than a crashed app.
const attempt = (fn, fallback = null) => {
  if (typeof window === 'undefined') return fallback
  try {
    return fn()
  } catch {
    return fallback
  }
}

/** True when the current login asked not to be remembered past this window. */
export function isSessionOnly() {
  return attempt(() => window.sessionStorage.getItem(PERSIST_KEY) === 'session', false)
}

/**
 * Record which store the session belongs in. Call this before writing any
 * session value, i.e. at the top of a login flow.
 */
export function setSessionOnly(sessionOnly) {
  attempt(() => {
    if (sessionOnly) window.sessionStorage.setItem(PERSIST_KEY, 'session')
    else window.sessionStorage.removeItem(PERSIST_KEY)
  })
}

const activeStore = () => (isSessionOnly() ? window.sessionStorage : window.localStorage)

/** Read a session value, whichever store this login put it in. */
export function readStored(key) {
  return attempt(() => window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key))
}

/**
 * Write a session value to the store this login chose, clearing the other one
 * so a "remember me" session can never be shadowed by a leftover from a
 * session-only login (or the reverse).
 */
export function writeStored(key, value) {
  attempt(() => {
    const store = activeStore()
    const other = store === window.localStorage ? window.sessionStorage : window.localStorage
    other.removeItem(key)
    store.setItem(key, value)
  })
}

/** Drop the whole session from both stores. */
export function clearStoredSession() {
  attempt(() => {
    for (const key of SESSION_KEYS) {
      window.localStorage.removeItem(key)
      window.sessionStorage.removeItem(key)
    }
    window.sessionStorage.removeItem(PERSIST_KEY)
  })
}

/**
 * Is there a session to restore? True from the very first frame — before
 * Firebase Auth has finished rehydrating its token — which is what lets the
 * app hold the landing page back instead of showing it to someone who is
 * already signed in.
 */
export function hasStoredSession() {
  return !!readStored('fh_familyId')
}
