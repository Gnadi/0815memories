import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

function getAdminApp() {
  if (getApps().length) return getApps()[0]
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      // Vercel stores the private key with literal \n — replace them with real newlines
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { familyId, title, body, url } = req.body ?? {}

  if (!familyId || !title) {
    return res.status(400).json({ error: 'familyId and title are required' })
  }

  if (
    !process.env.FIREBASE_ADMIN_PROJECT_ID ||
    !process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
    !process.env.FIREBASE_ADMIN_PRIVATE_KEY
  ) {
    // Gracefully skip instead of crashing — notifications are non-critical
    console.warn('Firebase Admin env vars not set — skipping push notification')
    return res.json({ sent: 0, skipped: true })
  }

  try {
    const app = getAdminApp()
    const db = getFirestore(app)
    const fcmMessaging = getMessaging(app)

    // Fetch all FCM tokens registered for this family
    const snapshot = await db
      .collection('fcmTokens')
      .where('familyId', '==', familyId)
      .get()

    const tokens = snapshot.docs.map((d) => d.data().token).filter(Boolean)

    if (!tokens.length) {
      return res.json({ sent: 0 })
    }

    // Send data-only messages — the service worker push handler displays them,
    // giving us full control over the notification appearance on all platforms.
    const results = await Promise.allSettled(
      tokens.map((token) =>
        fcmMessaging.send({
          token,
          data: {
            title,
            body: body || '',
            url: url || '/',
          },
        })
      )
    )

    const sent = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    // Clean up stale tokens that FCM rejected (unregistered devices)
    const staleTokenDocs = snapshot.docs.filter((_, i) => results[i].status === 'rejected')
    await Promise.allSettled(staleTokenDocs.map((d) => d.ref.delete()))

    return res.json({ sent, failed })
  } catch (err) {
    console.error('send-notification error:', err)
    return res.status(500).json({ error: 'Failed to send notifications' })
  }
}
