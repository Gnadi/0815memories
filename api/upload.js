// Vercel Serverless Function: POST /api/upload
// Admin-only. Verifies Firebase ID token, then returns Cloudinary signed
// upload parameters. The client uses these to upload directly to Cloudinary
// (avoids Vercel's 4.5MB body limit and serverless timeout).

import crypto from 'crypto'
import { jwtVerify, createRemoteJWKSet } from 'jose'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
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

async function verifyFirebaseToken(idToken) {
  initAdmin()
  const adminAuth = getAuth()
  const decoded = await adminAuth.verifyIdToken(idToken)
  return decoded
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify admin Firebase ID token
  const authHeader = req.headers.authorization ?? ''
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!idToken) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    await verifyFirebaseToken(idToken)
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  const { folder = 'memories' } = req.body ?? {}

  const timestamp = Math.round(Date.now() / 1000)
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  // Cloudinary requires params sorted alphabetically before signing
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`
  const signature = crypto
    .createHash('sha1')
    .update(paramsToSign + apiSecret)
    .digest('hex')

  return res.status(200).json({
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder,
  })
}
