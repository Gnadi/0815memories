/**
 * Vercel Cron Job — Daily Anniversary Reminder
 *
 * Replaces the Firebase Scheduled Cloud Function (which requires Blaze plan).
 * Runs via Vercel Cron (Hobby plan: free, daily minimum).
 * Schedule defined in vercel.json: "0 8 * * *" (08:00 UTC = 09:00 MEZ / 10:00 MESZ)
 *
 * Required environment variables in Vercel:
 *   FIREBASE_SERVICE_ACCOUNT_JSON  — JSON string of the Firebase service account key
 *   CRON_SECRET                    — Vercel auto-injects this for cron requests
 *
 * Security: Vercel automatically sets Authorization: Bearer <CRON_SECRET> on cron
 * invocations. Manual requests without the correct token are rejected with 401.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore'
import { buildAnniversaryPayloads } from '../functions/anniversaryHelpers.js'

export default async function handler(req, res) {
  // Only allow GET (Vercel cron) and POST (manual trigger for testing)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed')
  }

  // Reject requests without the correct cron secret
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).end('Unauthorized')
  }

  // Initialise Firebase Admin SDK once (Vercel may reuse the Node.js process)
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    initializeApp({ credential: cert(serviceAccount) })
  }

  const db = getFirestore()

  const today = new Date()
  const threeYearsAgo = new Date(today.getFullYear() - 3, today.getMonth(), today.getDate())
  const start = new Date(threeYearsAgo)
  start.setHours(0, 0, 0, 0)
  const end = new Date(threeYearsAgo)
  end.setHours(23, 59, 59, 999)

  const snapshot = await db
    .collection('memories')
    .where('date', '>=', Timestamp.fromDate(start))
    .where('date', '<=', Timestamp.fromDate(end))
    .get()

  if (snapshot.empty) {
    console.log('[anniversary-cron] no memories found for', start.toDateString())
    return res.status(200).json({ notified: 0 })
  }

  const payloads = buildAnniversaryPayloads(snapshot.docs, threeYearsAgo)

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

  console.log(`[anniversary-cron] notified ${payloads.length} families for ${start.toDateString()}`)
  return res.status(200).json({ notified: payloads.length })
}
