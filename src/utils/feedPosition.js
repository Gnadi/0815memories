// The home feed is rebuilt from scratch when the user comes back from a
// memory: the page shows a spinner until the subscription has delivered, so the
// browser has nothing to restore the scroll position against. We remember which
// card was opened instead and scroll it back into view once the feed exists.
const KEY = 'kaydo:feedMemoryId'

export function rememberFeedMemory(id) {
  try {
    sessionStorage.setItem(KEY, id)
  } catch {
    // Storage can be blocked; the feed then simply starts at the top.
  }
}

// Returns the remembered id once; a later visit to the home page starts at the top.
export function takeFeedMemory() {
  try {
    const id = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    return id
  } catch {
    return null
  }
}
