/**
 * Vercel API — Admin Removal
 *
 * Revokes admin access for a UID in a family and deletes the underlying
 * Firebase Auth user. Called from the Manage Admins UI in SettingsPanel.
 *
 * Required environment variables:
 *   FIREBASE_SERVICE_ACCOUNT_JSON  — JSON string of the Firebase service account key
 *
 * Auth: caller must be an existing admin of the target family.
 *
 * Invariants enforced:
 *   - The family owner (`adminUid`) is non-removable.
 *   - The last remaining admin cannot remove themselves (would strand the family).
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

function ensureAdminApp() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured')
    initializeApp({ credential: cert(JSON.parse(raw)) })
  }
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string' && req.body.length > 0) {
    try { return JSON.parse(req.body) } catch { return null }
  }
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => {
      if (!data) return resolve({})
      try { resolve(JSON.parse(data)) } catch { resolve(null) }
    })
    req.on('error', () => resolve(null))
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const authHeader = req.headers.authorization || ''
  const match = authHeader.match(/^Bearer (.+)$/)
  if (!match) {
    return res.status(401).json({ error: 'Missing bearer token' })
  }
  const idToken = match[1]

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }

  const { targetUid, familyId } = body
  if (typeof targetUid !== 'string' || targetUid.length === 0) {
    return res.status(400).json({ error: 'Missing targetUid' })
  }
  if (typeof familyId !== 'string' || familyId.length === 0) {
    return res.status(400).json({ error: 'Missing familyId' })
  }

  try {
    ensureAdminApp()
  } catch (err) {
    console.error('[admin-remove] init error', err)
    return res.status(500).json({ error: 'Server not configured' })
  }

  const auth = getAuth()
  const db = getFirestore()

  let callerUid
  try {
    const decoded = await auth.verifyIdToken(idToken)
    callerUid = decoded.uid
  } catch {
    return res.status(401).json({ error: 'Invalid bearer token' })
  }

  const familyRef = db.collection('families').doc(familyId)
  const familySnap = await familyRef.get()
  if (!familySnap.exists) {
    return res.status(404).json({ error: 'Family not found' })
  }
  const familyData = familySnap.data() || {}
  const adminUids = Array.isArray(familyData.adminUids)
    ? familyData.adminUids
    : (familyData.adminUid ? [familyData.adminUid] : [])
  if (!adminUids.includes(callerUid)) {
    return res.status(403).json({ error: 'Not an admin of this family' })
  }

  if (targetUid === familyData.adminUid) {
    return res.status(400).json({ error: 'The family owner cannot be removed' })
  }
  if (!adminUids.includes(targetUid)) {
    return res.status(404).json({ error: 'User is not an admin of this family' })
  }
  if (targetUid === callerUid && adminUids.length <= 1) {
    return res.status(400).json({ error: 'Cannot remove the last admin' })
  }

  try {
    const batch = db.batch()
    batch.update(familyRef, { adminUids: FieldValue.arrayRemove(targetUid) })
    batch.delete(familyRef.collection('admins').doc(targetUid))
    await batch.commit()
  } catch (err) {
    console.error('[admin-remove] firestore write failed', err)
    return res.status(500).json({ error: 'Failed to revoke admin access' })
  }

  try {
    await auth.deleteUser(targetUid)
  } catch (err) {
    // Firestore is the source of truth for authorization, so even if auth
    // deletion fails the user can no longer access the family. Log and proceed.
    console.error('[admin-remove] auth.deleteUser failed', err)
  }

  return res.status(200).json({ ok: true })
}
