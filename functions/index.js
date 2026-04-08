/**
 * Firebase Cloud Function — FCM Push Dispatcher
 *
 * Triggered when a document is created in the `notificationsQueue` collection.
 * Reads FCM tokens for the family, sends push messages, then deletes the queue doc.
 *
 * No credentials needed — Firebase injects the service account automatically
 * when running inside Cloud Functions.
 *
 * Deployment (one-time):
 *   npm install -g firebase-tools
 *   firebase login
 *   firebase use <your-project-id>
 *   cd functions && npm install && cd ..
 *   firebase deploy --only functions
 *
 * Requires: Firebase Blaze (pay-as-you-go) plan.
 * Free tier within Blaze: 2M invocations/month — more than enough for a family app.
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

// No credentials arg — Firebase injects them automatically in the Cloud Functions runtime
initializeApp()

export const dispatchPushNotifications = onDocumentCreated(
  'notificationsQueue/{docId}',
  async (event) => {
    const data = event.data?.data()

    // Always clean up, even on early return
    const cleanup = () => event.data?.ref.delete().catch(() => {})

    if (!data) return cleanup()

    const { familyId, title, body, url } = data

    if (!familyId || !title) return cleanup()

    const db = getFirestore()
    const messaging = getMessaging()

    // Fetch all FCM tokens registered for this family
    const snapshot = await db
      .collection('fcmTokens')
      .where('familyId', '==', familyId)
      .get()

    const tokenDocs = snapshot.docs
    const tokens = tokenDocs.map((d) => d.data().token).filter(Boolean)

    if (tokens.length === 0) return cleanup()

    // Send data-only messages — the service worker push handler displays them,
    // giving full control over the notification appearance.
    const results = await Promise.allSettled(
      tokens.map((token) =>
        messaging.send({
          token,
          data: {
            title,
            body: body || '',
            url: url || '/',
          },
        })
      )
    )

    // Remove stale tokens that FCM rejected (e.g. unregistered devices)
    const staleTokenDocs = tokenDocs.filter((_, i) => results[i].status === 'rejected')
    await Promise.allSettled(staleTokenDocs.map((d) => d.ref.delete()))

    const sent = results.filter((r) => r.status === 'fulfilled').length
    console.log(`[push] sent=${sent} failed=${results.length - sent} family=${familyId}`)

    return cleanup()
  }
)
