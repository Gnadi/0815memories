import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { familyId, title, body, url } = req.body || {}
  if (!familyId || !title) {
    return res.status(400).json({ error: 'Missing familyId or title' })
  }

  const app = getAdminApp()
  const db = getFirestore(app)
  const messaging = getMessaging(app)

  const snapshot = await db.collection('fcmTokens').where('familyId', '==', familyId).get()
  const tokenDocs = snapshot.docs
  const tokens = tokenDocs.map(d => d.data().token).filter(Boolean)

  if (tokens.length === 0) return res.status(200).json({ sent: 0 })

  const results = await Promise.allSettled(
    tokens.map(token =>
      messaging.send({ token, data: { title, body: body || '', url: url || '/' } })
    )
  )

  const stale = tokenDocs.filter((_, i) => results[i].status === 'rejected')
  await Promise.allSettled(stale.map(d => d.ref.delete()))

  const sent = results.filter(r => r.status === 'fulfilled').length
  return res.status(200).json({ sent, failed: results.length - sent })
}
