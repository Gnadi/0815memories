/**
 * Vercel API — Admin Invitation
 *
 * Creates a new Firebase Auth user with admin permissions on exactly one family.
 * Called from the Manage Admins UI in SettingsPanel.
 *
 * Required environment variables:
 *   FIREBASE_SERVICE_ACCOUNT_JSON  — JSON string of the Firebase service account key
 *
 * Auth: caller must be an existing admin of the target family. The bearer token
 * is a Firebase ID token from `auth.currentUser.getIdToken()`. The body's
 * `familyId` is treated as untrusted and verified server-side.
 *
 * Family-isolation guarantee: a Firebase Auth UID is allowed to belong to only
 * one family. If the email already has any Firebase Auth account we refuse,
 * which keeps `resolveFamilyId` deterministic and prevents cross-family leaks.
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

  const { email, password, familyId } = body
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Invalid email' })
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }
  if (typeof familyId !== 'string' || familyId.length === 0) {
    return res.status(400).json({ error: 'Missing familyId' })
  }

  try {
    ensureAdminApp()
  } catch (err) {
    console.error('[admin-invite] init error', err)
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

  // Verify caller is an admin of THIS family. The body's familyId is untrusted —
  // this is the cross-family guard.
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

  // A Firebase Auth UID is allowed to belong to only one family. If the email
  // already has any account, we refuse — even if "the other family" is the
  // same one the caller is operating on.
  const normalizedEmail = email.trim().toLowerCase()
  try {
    const existing = await auth.getUserByEmail(normalizedEmail)
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists' })
    }
  } catch (err) {
    if (err?.code !== 'auth/user-not-found') {
      console.error('[admin-invite] getUserByEmail error', err)
      return res.status(500).json({ error: 'Failed to check existing users' })
    }
  }

  let newUser
  try {
    newUser = await auth.createUser({
      email: normalizedEmail,
      password,
      emailVerified: false,
      disabled: false,
    })
  } catch (err) {
    console.error('[admin-invite] createUser error', err)
    if (err?.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: 'A user with this email already exists' })
    }
    if (err?.code === 'auth/invalid-password') {
      return res.status(400).json({ error: 'Password rejected by Firebase Auth' })
    }
    return res.status(500).json({ error: 'Failed to create user' })
  }

  const newUid = newUser.uid

  try {
    const batch = db.batch()
    batch.update(familyRef, { adminUids: FieldValue.arrayUnion(newUid) })
    batch.set(familyRef.collection('admins').doc(newUid), {
      email: normalizedEmail,
      addedBy: callerUid,
      addedAt: FieldValue.serverTimestamp(),
    })
    await batch.commit()
  } catch (err) {
    // Roll back the auth user so we don't strand an orphan account.
    console.error('[admin-invite] firestore write failed, rolling back auth user', err)
    try { await auth.deleteUser(newUid) } catch { /* best effort */ }
    return res.status(500).json({ error: 'Failed to register admin in family' })
  }

  return res.status(200).json({ uid: newUid, email: normalizedEmail })
}
