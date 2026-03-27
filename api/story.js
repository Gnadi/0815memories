// Vercel Serverless Function: POST /api/story (create) and DELETE /api/story?id=X
// Admin-only. Manages story documents in Firestore.

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
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

  try {
    await verifyAdmin(req.headers.authorization)
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  initAdmin()
  const db = getFirestore()

  if (req.method === 'POST') {
    const { image, label, authorName } = req.body ?? {}
    if (!image) return res.status(400).json({ error: 'image required' })

    const docRef = await db.collection('stories').add({
      image,
      label: label ?? '',
      authorName: authorName ?? 'Family',
      date: new Date(),
      createdAt: FieldValue.serverTimestamp(),
    })
    return res.status(201).json({ id: docRef.id })
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'id required' })
    await db.collection('stories').doc(id).delete()
    return res.status(200).json({ deleted: id })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
