/**
 * App Check: proof, attached to every call of a Cloud Function, that it comes
 * from this app in a real browser, which is what makes the guessing at the
 * viewer login and the other public callables costly for a script.
 *
 * Off until VITE_APPCHECK_SITE_KEY names a reCAPTCHA Enterprise key registered
 * for the app under Firebase Console → App Check. The functions enforce it only
 * once ENFORCE_APP_CHECK is set on them, which comes after installed PWAs have
 * picked up a build that sends it (docs/plan-a-zugriffskontrolle.md).
 *
 * Loaded on demand, so the reCAPTCHA script stays out of the startup bundle,
 * and callers await appCheckReady() before a call, so the very first call
 * already carries a token. The app is found with getApp() rather than imported
 * from ./firebase, which the tests replace. Never rejects: without App Check a
 * call goes out as before, and the server decides.
 */
import { getApp } from 'firebase/app'

const SITE_KEY = import.meta.env.VITE_APPCHECK_SITE_KEY
const USE_EMULATOR = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === 'true'

let ready = null

export function appCheckReady() {
  if (!SITE_KEY || USE_EMULATOR || typeof window === 'undefined') return Promise.resolve(null)
  if (!ready) {
    let app
    try {
      app = getApp()
    } catch {
      // Firebase is not configured (or this is the demo): nothing to protect.
      return Promise.resolve(null)
    }
    ready = import('firebase/app-check')
      .then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) => initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      }))
      .catch((e) => {
        if (import.meta.env.DEV) console.warn('App Check unavailable:', e.message)
        return null
      })
  }
  return ready
}
