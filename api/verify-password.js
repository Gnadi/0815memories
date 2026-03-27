import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { password } = req.body

    if (!password) {
      return res.status(400).json({ error: 'Password is required' })
    }

    const settingsDoc = await db.collection('settings').doc('auth').get()

    if (!settingsDoc.exists) {
      return res.status(500).json({ error: 'App not configured. Admin must set a password first.' })
    }

    const { passwordHash } = settingsDoc.data()
    const isValid = await bcrypt.compare(password, passwordHash)

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid password' })
    }

    const token = jwt.sign(
      { role: 'viewer', iat: Math.floor(Date.now() / 1000) },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    return res.status(200).json({ token })
  } catch (error) {
    console.error('Auth error:', error)
    return res.status(500).json({ error: 'Authentication failed' })
  }
}
