import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getMessaging } from 'firebase/messaging'

// Dev-only: route Auth + Firestore to the local Firebase Emulator Suite.
// Strictly gated so production never connects to an emulator.
const USE_EMULATOR =
  import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === 'true'

let app = null
let auth = null
let db = null
let messaging = null

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

    // Messaging is only available in browser windows, not service workers.
    // It also has no emulator, so skip it entirely in emulator mode.
    if (!USE_EMULATOR && typeof window !== 'undefined' && 'Notification' in window) {
      try {
        messaging = getMessaging(app)
      } catch (e) {
        if (import.meta.env.DEV) console.warn('Firebase Messaging unavailable:', e.message)
      }
    }
  } else if (import.meta.env.DEV) {
    console.warn('Firebase env vars not set — app running in demo mode')
  }
} catch (e) {
  if (import.meta.env.DEV) console.error('Firebase initialization failed:', e)
}

export { auth, db, messaging }
export default app
