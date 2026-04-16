/**
 * Firebase Cloud Functions — FCM Push Dispatcher + Scheduled Anniversary Reminder
 *
 * dispatchPushNotifications:
 *   Triggered when a document is created in the `notificationsQueue` collection.
 *   Reads FCM tokens for the family, sends push messages, then deletes the queue doc.
 *
 * scheduledAnniversaryNotification:
 *   Runs daily at 09:00 Europe/Berlin.  Finds every family that has memories from
 *   exactly 3 years ago and writes one entry per family to `notificationsQueue`,
 *   which in turn triggers dispatchPushNotifications automatically.
 *   Requires Firebase Blaze plan (Google Cloud Scheduler).
 *
 * No credentials needed — Firebase injects the service account automatically
 * when running inside Cloud Functions.
 *
 * Deployment:
 *   npm install -g firebase-tools
 *   firebase login
 *   firebase use <your-project-id>
 *   cd functions && npm install && cd ..
 *   firebase deploy --only functions
 */

import { firestore, pubsub } from 'firebase-functions'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { buildAnniversaryPayloads } from './anniversaryHelpers.js'

export { buildAnniversaryPayloads }

// No credentials arg — Firebase injects them automatically in the Cloud Functions runtime
initializeApp()

// ---------------------------------------------------------------------------
// Cloud Function 1: dispatch FCM when a notificationsQueue doc is created
// ---------------------------------------------------------------------------

export const dispatchPushNotifications = firestore
  .document('notificationsQueue/{docId}')
  .onCreate(async (snapshot) => {
    const data = snapshot.data()

    // Always clean up the queue doc, even on early return
    const cleanup = () => snapshot.ref.delete().catch(() => {})

    if (!data) return cleanup()

    const { familyId, title, body, url } = data

    if (!familyId || !title) return cleanup()

    const db = getFirestore()
    const messaging = getMessaging()

    // Fetch all FCM tokens registered for this family
    const tokenSnapshot = await db
      .collection('fcmTokens')
      .where('familyId', '==', familyId)
      .get()

    const tokenDocs = tokenSnapshot.docs
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
  })

// ---------------------------------------------------------------------------
// Cloud Function 2: daily anniversary reminder (requires Firebase Blaze plan)
// ---------------------------------------------------------------------------

export const scheduledAnniversaryNotification = pubsub
  .schedule('every day 09:00')
  .timeZone('Europe/Berlin')
  .onRun(async () => {
    const db = getFirestore()

    // Calculate the date range for exactly 3 years ago (midnight-to-midnight)
    const today = new Date()
    const threeYearsAgo = new Date(today.getFullYear() - 3, today.getMonth(), today.getDate())
    const start = new Date(threeYearsAgo)
    start.setHours(0, 0, 0, 0)
    const end = new Date(threeYearsAgo)
    end.setHours(23, 59, 59, 999)

    // Find all memories from exactly 3 years ago (date field is NOT encrypted)
    const snapshot = await db
      .collection('memories')
      .where('date', '>=', Timestamp.fromDate(start))
      .where('date', '<=', Timestamp.fromDate(end))
      .get()

    if (snapshot.empty) {
      console.log('[anniversary] no memories found for', start.toDateString())
      return null
    }

    const payloads = buildAnniversaryPayloads(snapshot.docs, threeYearsAgo)

    // Write one notificationsQueue entry per family →
    // dispatchPushNotifications picks them up and sends FCM messages
    await Promise.allSettled(
      payloads.map(({ familyId, count, year }) =>
        db.collection('notificationsQueue').add({
          familyId,
          title: '📷 3 Jahre ist es her…',
          body: `Du hast ${count} ${count === 1 ? 'Erinnerung' : 'Erinnerungen'} vom ${year}.`,
          url: '/timeline?filter=onthisday',
          createdAt: FieldValue.serverTimestamp(),
        })
      )
    )

    console.log(`[anniversary] notified ${payloads.length} families for ${start.toDateString()}`)
    return null
  })
