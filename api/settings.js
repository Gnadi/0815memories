// Vercel Serverless Function: POST /api/settings
// Admin-only. Updates app settings including inner circle password hash.

import bcrypt from 'bcryptjs'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

function initAdmin() {
  if (getApps().length > 0) return
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  })
}

async function verifyAdmin(authHeader) {
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!idToken) throw new Error('No token')
  initAdmin()
  await getAuth().verifyIdToken(idToken)
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    await verifyAdmin(req.headers.authorization)
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { newPassword, appName, heroImage } = req.body ?? {}

  initAdmin()
  const db = getFirestore()
  const updates = {}

  if (newPassword) {
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }
    updates.innerCirclePasswordHash = await bcrypt.hash(newPassword, 12)
  }

  if (appName) updates.appName = appName
  if (heroImage) updates.heroImage = heroImage

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Nothing to update' })
  }

  await db.collection('settings').doc('app').set(updates, { merge: true })

  return res.status(200).json({ updated: true })
}
