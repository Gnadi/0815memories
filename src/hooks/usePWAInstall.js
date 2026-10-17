import { useCallback, useSyncExternalStore } from 'react'

function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

/**
 * Safari on iPhone and iPad never offers an install prompt: the app goes on
 * the home screen through the share menu, so all we can do is say how.
 */
export function isIOSBrowser() {
  if (typeof navigator === 'undefined') return false
  return /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// Shared install-prompt state so any component (footer link, install banner,
// settings page…) can trigger the native PWA install flow from the same
// captured event. Captured here, at module level, rather than in each hook:
// the browser fires `beforeinstallprompt` once, early, and a lazily loaded page
// mounting after that — the settings page — never saw it.
let state = { deferredPrompt: null, installed: isStandalone() }
const listeners = new Set()

function update(next) {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
}

// Only in the browser: the landing page is pre-rendered in Node.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    update({ deferredPrompt: e })
  })
  window.addEventListener('appinstalled', () => {
    update({ installed: true, deferredPrompt: null })
  })
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => state
const serverSnapshot = { deferredPrompt: null, installed: false }
const getServerSnapshot = () => serverSnapshot

export default function usePWAInstall() {
  const { deferredPrompt, installed } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // A captured prompt can be shown only once, whatever the answer.
  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    update({ deferredPrompt: null })
    return outcome === 'accepted'
  }, [deferredPrompt])

  return { canInstall: !installed && !!deferredPrompt, installed, promptInstall }
}
