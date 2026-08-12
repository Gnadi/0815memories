import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { getMessagingInstance, db } from '../config/firebase'
import i18n from '../i18n'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

// The token of *this* device, once we know it. Trigger call sites pass it to
// api/send-push as `excludeToken` so the author of a memory is not notified
// about their own memory.
let currentToken = null

export function getCurrentToken() {
  return currentToken
}

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

  // The token IS the document id — one document per physical device, and the
  // upsert needs no read. That matters: firestore.rules denies reads on this
  // collection (a client must not be able to enumerate a family's devices), so
  // the previous "query by token, then add or update" dance failed on its very
  // first step and no token was ever stored.
  //
  // `lang` travels with the token because api/send-push writes the notification
  // text at send time, in the *recipient's* language rather than the sender's.
  await setDoc(
    doc(db, 'fcmTokens', token),
    {
      familyId,
      token,
      lang: i18n.resolvedLanguage === 'en' ? 'en' : 'de',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )

  currentToken = token
  return token
}
