// Vercel Serverless Function: POST /api/auth
// Verifies the inner-circle shared password and returns a signed JWT.
// Uses Firebase Admin SDK to read the bcrypt hash from Firestore.
// Uses bcryptjs to compare — intentionally slow (~300ms at work factor 12).

import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

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

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { password } = req.body ?? {}

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password required' })
  }

  try {
    initAdmin()
    const db = getFirestore()
    const settingsSnap = await db.collection('settings').doc('app').get()

    if (!settingsSnap.exists) {
      return res.status(503).json({ error: 'App not configured yet' })
    }

    const { innerCirclePasswordHash } = settingsSnap.data()

    if (!innerCirclePasswordHash) {
      return res.status(503).json({ error: 'Password not set' })
    }

    const match = await bcrypt.compare(password, innerCirclePasswordHash)

    if (!match) {
      // Generic message — don't reveal whether user/password is wrong
      return res.status(401).json({ error: 'Wrong password. Try again.' })
    }

    const secret = new TextEncoder().encode(process.env.INNER_CIRCLE_SESSION_SECRET)
    const token = await new SignJWT({ role: 'inner-circle' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret)

    return res.status(200).json({ token })
  } catch (err) {
    console.error('[api/auth] error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
