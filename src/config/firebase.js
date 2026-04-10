import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getMessaging } from 'firebase/messaging'

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
    // Messaging is only available in browser windows, not service workers
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        messaging = getMessaging(app)
      } catch (e) {
        console.warn('Firebase Messaging unavailable:', e.message)
      }
    }
  } else {
    console.warn('Firebase env vars not set — app running in demo mode')
  }
} catch (e) {
  console.error('Firebase initialization failed:', e)
}

export { auth, db, messaging }
export default app
