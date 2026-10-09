/**
 * Whether this tab shows the demo family.
 *
 * The demo runs entirely in the browser: Firebase is never initialised
 * (config/firebase.js), every query goes to an in-memory database
 * (config/firestore.js, demo/demoDatabase.js), and the signed-in session is
 * made up in AuthContext. All of them ask this flag.
 *
 * It lives in sessionStorage, so it belongs to one tab: a real login in
 * another tab of the same browser is untouched, the demo ends when the tab
 * closes, and a reload stays in the demo, starting it afresh. A browser that
 * refuses sessionStorage cannot enter the demo at all, since the flag has to
 * survive the navigation into it.
 *
 * Entering and leaving are hard navigations, and must stay so. The flag is
 * read once per page load — config/firebase.js decides on it whether to start
 * Firebase at all — so flipping it under a running app would leave the app
 * half in one world and half in the other. They replace the current history
 * entry: going back should not walk through the switch again.
 *
 * This module is in the startup bundle; the rest of the demo is loaded only
 * once a tab is in it (demo/index.js).
 */

// index.html reads it too, to keep the landing page covered in a demo tab.
const KEY = 'kaydo_demo'

export function isDemoMode() {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function enterDemo(target = '/home') {
  try {
    window.sessionStorage.setItem(KEY, '1')
  } catch {
    // Nothing to remember it in; the target opens as it would anyway.
  }
  window.location.replace(target)
}

export function exitDemo(target = '/') {
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    // Never set, then.
  }
  window.location.replace(target)
}

// A page the browser restores from its back/forward cache keeps the mode it
// was loaded in, which may no longer be the tab's: back into the demo after
// leaving it, or back out of it after entering. A real sign-in on such a page
// would leave the flag behind for the next reload to find. Loading it afresh
// puts the page in the tab's mode.
if (typeof window !== 'undefined') {
  const loadedAsDemo = isDemoMode()
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && isDemoMode() !== loadedAsDemo) window.location.reload()
  })
}
