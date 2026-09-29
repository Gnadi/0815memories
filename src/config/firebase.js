import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import {
  initializeFirestore,
  memoryLocalCache,
  memoryLruGarbageCollector,
  connectFirestoreEmulator,
  terminate,
} from 'firebase/firestore'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'

// Dev-only: route Auth + Firestore to the local Firebase Emulator Suite.
// Strictly gated so production never connects to an emulator.
const USE_EMULATOR =
  import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === 'true'

// Must match setGlobalOptions() in functions/index.js.
const FUNCTIONS_REGION = 'europe-west3'

let app = null
let auth = null
let db = null
let functions = null

// Documents stay in memory after the listener that fetched them closes, until
// the cache needs the room. The default collects them the moment no listener
// needs them, so every page change re-read its data from the server: Home, a
// memory, back to Home was the same 60 documents downloaded — and billed —
// twice. With them kept, the next listener for the same query starts from
// memory and resumes it rather than running it again.
//
// Memory only, never IndexedDB: these documents include the family document,
// encryption key and all, which must not outlive the tab. logout() starts a
// fresh instance for the same reason — see resetFirestore().
function createFirestore() {
  const instance = initializeFirestore(app, {
    localCache: memoryLocalCache({ garbageCollector: memoryLruGarbageCollector() }),
  })
  if (USE_EMULATOR) connectFirestoreEmulator(instance, '127.0.0.1', 8080)
  return instance
}

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
    db = createFirestore()
    // Pinned to the region the callables are deployed to. Without the region
    // the SDK calls us-central1 and every viewer login 404s.
    functions = getFunctions(app, FUNCTIONS_REGION)

    if (USE_EMULATOR) {
      // Point the SDK at the local emulators (started via `firebase emulators:start`).
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
      connectFunctionsEmulator(functions, '127.0.0.1', 5001)
      console.info('🔧 Firebase running against local emulators (Auth:9099, Firestore:8080, Functions:5001)')
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

// Storage holds one thing: the unencrypted print file of a scrapbook an admin
// is ordering from Peecho (see utils/printUpload.js). Everything else lives on
// Cloudinary as ciphertext. Loaded on demand for the same reason as messaging —
// only someone ordering a print ever needs it. Resolves to null when Firebase
// is not configured.
let storagePromise = null

export function getStorageInstance() {
  if (!app) return Promise.resolve(null)
  if (!storagePromise) {
    storagePromise = import('firebase/storage').then(({ getStorage, connectStorageEmulator }) => {
      const storage = getStorage(app)
      if (USE_EMULATOR) connectStorageEmulator(storage, '127.0.0.1', 9199)
      return storage
    })
    storagePromise.catch(() => { storagePromise = null })
  }
  return storagePromise
}

/**
 * Drop every document this tab has cached, by replacing the Firestore instance.
 *
 * Called on logout. Kept documents are the point of the LRU cache above, but
 * not across sessions: the next person to sign in on this device must not
 * start from the previous one's family document. `db` is a live binding, so
 * every module reading it after this sees the new instance.
 */
export async function resetFirestore() {
  if (!db) return
  await terminate(db).catch(() => {})
  db = createFirestore()
}

export { auth, db, functions }
export default app
