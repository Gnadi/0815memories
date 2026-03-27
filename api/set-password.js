import bcrypt from 'bcryptjs'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  })
}

const db = getFirestore()
const adminAuth = getAuth()

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const idToken = authHeader.split('Bearer ')[1]
    await adminAuth.verifyIdToken(idToken)

    const { password } = req.body
    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    await db.collection('settings').doc('auth').set(
      { passwordHash, updatedAt: new Date().toISOString() },
      { merge: true }
    )

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Set password error:', error)
    return res.status(500).json({ error: 'Failed to set password' })
  }
}
