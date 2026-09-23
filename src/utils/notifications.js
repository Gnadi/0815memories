import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import i18n from '../i18n'
import { devWarn } from './devLog'
import { getMessagingInstance, auth, db } from '../config/firebase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

/** Where this device's token document lives. */
const TOKEN_ID_KEY = 'kaydo_fcm_token_id'

/**
 * The document id for a token: its SHA-256, hex-encoded.
 *
 * Deliberately derived rather than looked up. The previous version queried
 * `fcmTokens` for an existing document, which `firestore.rules` denies outright
 * (`allow read: if false`) — the query threw, nothing was ever written, and
 * every push since had an empty token list to send to. A deterministic id needs
 * no read: the same device writing twice lands on the same document.
 */
async function tokenDocId(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * iOS delivers Web Push only from an installed PWA — in a Safari tab the
 * permission prompt appears and the subscription then fails. Checking first
 * means we can say "add to home screen" instead of silently failing.
 */
export function isPushSupported() {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false
  }
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (!isIOS) return true
  return (
    window.navigator.standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true
  )
}

/**
 * Requests notification permission, obtains the FCM push token and stores it in
 * the Firestore `fcmTokens` collection.
 *
 * Throws on a real failure — a denied write, an unreachable FCM — so the caller
 * can say so. Returns null when there is simply nothing to do (push
 * unsupported, permission refused, messaging unavailable).
 *
 * @param {string} familyId - The family this device should receive notifications for.
 * @returns {Promise<string|null>} The FCM token, or null.
 */
export async function requestAndSaveFCMToken(familyId) {
  if (!db || !familyId || !VAPID_KEY) return null
  if (!isPushSupported()) return null
  if (Notification.permission === 'denied') return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  // Both the SDK and the messaging instance are fetched here rather than at
  // module scope — this only ever runs after a deliberate user action.
  const [messaging, { getToken }] = await Promise.all([
    getMessagingInstance(),
    import('firebase/messaging'),
  ])
  if (!messaging) return null

  // Use the VitePWA-registered service worker so FCM tokens are scoped to it
  const swReg = await navigator.serviceWorker.ready
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg })
  if (!token) return null

  const id = await tokenDocId(token)
  await setDoc(
    doc(db, 'fcmTokens', id),
    {
      familyId,
      token,
      // The server composes the notification text, so it has to know which
      // language this device reads.
      lang: i18n.resolvedLanguage || i18n.language || 'de',
      // Whoever is signed in here. The triggers use it to skip the device that
      // created the memory in the first place.
      uid: auth?.currentUser?.uid || null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )

  try {
    localStorage.setItem(TOKEN_ID_KEY, id)
  } catch {
    // Private mode, or storage full. Only costs us the tidy logout below.
  }

  return token
}

/**
 * Drops this device's registration. Called on logout so a shared device stops
 * receiving a family's notifications the moment someone signs out of it.
 */
export async function removeFCMToken() {
  let id = null
  try {
    id = localStorage.getItem(TOKEN_ID_KEY)
    localStorage.removeItem(TOKEN_ID_KEY)
  } catch {
    id = null
  }

  try {
    const messaging = await getMessagingInstance()
    if (messaging) {
      const { deleteToken } = await import('firebase/messaging')
      await deleteToken(messaging)
    }
  } catch (err) {
    devWarn('deleteToken failed:', err)
  }

  if (!id || !db) return
  await deleteDoc(doc(db, 'fcmTokens', id)).catch((err) => devWarn('token cleanup failed:', err))
}

/**
 * Subscribes to foreground FCM messages (app is open).
 * Returns an unsubscribe function.
 *
 * Async because the messaging SDK is code-split; the returned unsubscribe is
 * safe to call before the subscription has actually been established.
 *
 * @param {function({title: string, body: string}): void} onNotification
 * @returns {Promise<function(): void>}
 */
export async function listenForegroundMessages(onNotification) {
  const [messaging, { onMessage }] = await Promise.all([
    getMessagingInstance(),
    import('firebase/messaging'),
  ])
  if (!messaging) return () => {}
  return onMessage(messaging, (payload) => {
    onNotification?.({
      title: payload.data?.title || 'Kaydo',
      body: payload.data?.body || '',
    })
  })
}
