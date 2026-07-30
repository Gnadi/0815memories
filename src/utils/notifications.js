import { getToken, onMessage } from 'firebase/messaging'
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { messaging, db, auth } from '../config/firebase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

/**
 * Requests notification permission, obtains the FCM push token,
 * and saves/updates it in the Firestore `fcmTokens` collection.
 *
 * @param {string} familyId - The family this device should receive notifications for.
 * @returns {string|null} The FCM token, or null if permission was denied or unavailable.
 */
export async function requestAndSaveFCMToken(familyId) {
  if (!messaging || !db || !familyId || !VAPID_KEY) return null
  if (!('Notification' in window)) return null
  if (Notification.permission === 'denied') return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  // Use the VitePWA-registered service worker so FCM tokens are scoped to it
  const swReg = await navigator.serviceWorker.ready
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg })
  if (!token) return null

  // Who is signed in on this device, if anyone. Viewers are not Firebase-
  // authenticated and stay null. Notifications that concern only some people in
  // a family (the "Our Year" ritual) set `targetUids` on the queue document,
  // and the dispatcher matches it against this field.
  const uid = auth?.currentUser?.uid ?? null

  // Upsert: one token document per physical device
  const q = query(collection(db, 'fcmTokens'), where('token', '==', token))
  const existing = await getDocs(q)
  if (existing.empty) {
    await addDoc(collection(db, 'fcmTokens'), {
      familyId,
      uid,
      token,
      createdAt: serverTimestamp(),
    })
  } else {
    // Keep familyId and uid in sync in case the device logs into a different
    // family or a different account
    await updateDoc(existing.docs[0].ref, { familyId, uid, updatedAt: serverTimestamp() })
  }

  return token
}

/**
 * Subscribes to foreground FCM messages (app is open).
 * Returns an unsubscribe function.
 *
 * @param {function({title: string, body: string}): void} onNotification
 */
export function listenForegroundMessages(onNotification) {
  if (!messaging) return () => {}
  return onMessage(messaging, (payload) => {
    onNotification?.({
      title: payload.data?.title || 'Kaydo',
      body: payload.data?.body || '',
    })
  })
}
