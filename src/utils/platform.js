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
