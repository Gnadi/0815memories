import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { getMessagingInstance, db } from '../config/firebase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

/**
 * Requests notification permission, obtains the FCM push token,
 * and saves/updates it in the Firestore `fcmTokens` collection.
 *
 * @param {string} familyId - The family this device should receive notifications for.
 * @returns {string|null} The FCM token, or null if permission was denied or unavailable.
 */
export async function requestAndSaveFCMToken(familyId) {
  if (!db || !familyId || !VAPID_KEY) return null
  if (!('Notification' in window)) return null
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

  // Upsert: one token document per physical device
  const q = query(collection(db, 'fcmTokens'), where('token', '==', token))
  const existing = await getDocs(q)
  if (existing.empty) {
    await addDoc(collection(db, 'fcmTokens'), {
      familyId,
      token,
      createdAt: serverTimestamp(),
    })
  } else {
    // Keep familyId in sync in case the device logs into a different family
    await updateDoc(existing.docs[0].ref, { familyId, updatedAt: serverTimestamp() })
  }

  return token
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
