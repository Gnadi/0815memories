// Which phone family the app runs on, for the few places where the two differ
// in what people expect: the look of the tab bar, and Android's system back
// button. Kaydo is one PWA for every device, so this can only be read from the
// browser at run time. It is a heuristic: "Request desktop website" hides the
// phone, and then the app falls back to the neutral 'other'.
export function detectPlatform() {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent || ''
  // iPadOS Safari reports itself as a Mac; only the touch points give it away.
  if (/iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios'
  }
  if (/Android/i.test(ua)) return 'android'
  return 'other'
}

// Whether Kaydo runs as the installed app (from the home screen) rather than
// in a browser tab. iOS Safari reports it on navigator, everyone else through
// the display-mode media query of the manifest.
export function isInstalledApp() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches === true ||
    window.navigator.standalone === true
}
