import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'

// Dev-only: route Auth + Firestore to the local Firebase Emulator Suite.
// Strictly gated so production never connects to an emulator.
const USE_EMULATOR =
  import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === 'true'

let app = null
let auth = null
let db = null

try {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }

  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)
    db = getFirestore(app)

    if (USE_EMULATOR) {
      // Point the SDK at the local emulators (started via `firebase emulators:start`).
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
      connectFirestoreEmulator(db, '127.0.0.1', 8080)
      console.info('🔧 Firebase running against local emulators (Auth:9099, Firestore:8080)')
    }

  } else if (import.meta.env.DEV) {
    console.warn('Firebase env vars not set — app running in demo mode')
  }
} catch (e) {
  if (import.meta.env.DEV) console.error('Firebase initialization failed:', e)
}

// Messaging is loaded on demand rather than at module scope: push is never
// needed for the first frame, and a static import pulled the whole
// firebase/messaging SDK into the startup bundle for every visitor.
//
// It is only available in browser windows (not service workers), and has no
// emulator, so it stays off in emulator mode. Returns null when unavailable.
let messagingPromise = null

export function getMessagingInstance() {
  if (!app || USE_EMULATOR) return Promise.resolve(null)
  if (typeof window === 'undefined' || !('Notification' in window)) return Promise.resolve(null)

  if (!messagingPromise) {
    messagingPromise = import('firebase/messaging')
      .then(({ getMessaging }) => getMessaging(app))
      .catch((e) => {
        if (import.meta.env.DEV) console.warn('Firebase Messaging unavailable:', e.message)
        return null
      })
  }
  return messagingPromise
}

export { auth, db }
export default app
