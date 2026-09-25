import { createHash } from 'crypto'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

// A signature is permission to write to the Cloudinary account, so it is only
// handed to family admins — the only people the app lets upload anything. This
// endpoint used to sign for any caller, which made the account a free file host
// for anyone who found the URL.
//
// Only the caller's ID token is checked, and that needs the project id but no
// service account: verifyIdToken() works from Google's public signing keys.
// Vercel exposes the build's VITE_ variables to functions at runtime too.
const projectId = () => process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID

function tokenVerifier() {
  if (!projectId()) return null
  return getAuth(getApps()[0] ?? initializeApp({ projectId: projectId() }))
}

/**
 * Is the caller an admin of some family by its document?
 *
 * The role claim is set by syncAdminClaims only for admins added after it
 * existed; earlier admins carry none unless the access-control migration was
 * run for them. firestore.rules accepts them by the family document instead
 * (isAdminByDocument), and so must this — refusing them was what broke photo
 * uploads for exactly those admins.
 *
 * Asked as the caller, through Firestore's REST API with their own ID token,
 * so Firestore's rules answer it and no service account is needed. The two
 * shapes of a family document are the two lookups AuthContext makes at sign-in:
 * `adminUids`, and the oldest families' lone `adminUid`. Only document names come
 * back — the family document also holds the encryption key.
 */
async function isAdminByDocument(idToken, uid) {
  const emulator = process.env.FIRESTORE_EMULATOR_HOST
  const base = emulator ? `http://${emulator}` : 'https://firestore.googleapis.com'
  const url = `${base}/v1/projects/${projectId()}/databases/(default)/documents:runQuery`
  const lookups = [
    { field: { fieldPath: 'adminUids' }, op: 'ARRAY_CONTAINS', value: { stringValue: uid } },
    { field: { fieldPath: 'adminUid' }, op: 'EQUAL', value: { stringValue: uid } },
  ]
  for (const fieldFilter of lookups) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'families' }],
          where: { fieldFilter },
          select: { fields: [{ fieldPath: '__name__' }] },
          limit: 1,
        },
      }),
    }).catch(() => null)
    if (!response?.ok) continue
    const rows = await response.json().catch(() => [])
    if (Array.isArray(rows) && rows.some((row) => row.document)) return true
  }
  return false
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  const secret = process.env.CLOUDINARY_API_SECRET
  const apiKey = process.env.CLOUDINARY_API_KEY
  const verifier = tokenVerifier()

  if (!secret || !apiKey || !verifier) {
    res.status(500).json({ error: 'Upload signing is not configured' })
    return
  }

  const bearer = /^Bearer (.+)$/.exec(req.headers?.authorization || '')?.[1]
  if (!bearer) {
    res.status(401).json({ error: 'Sign in first' })
    return
  }

  let claims
  try {
    claims = await verifier.verifyIdToken(bearer)
  } catch {
    res.status(401).json({ error: 'Sign in first' })
    return
  }

  // The claim is set by the syncAdminClaims trigger and costs nothing to check.
  // Viewers carry 'viewer' and never upload. Anyone else — an account without a
  // claim — may still be an admin by the family document, as the rules allow.
  const isAdmin =
    claims.role === 'admin' ||
    (claims.role !== 'viewer' && (await isAdminByDocument(bearer, claims.uid)))
  if (!isAdmin) {
    res.status(403).json({ error: 'Only family admins can upload' })
    return
  }

  const type = req.query?.type  // 'video_clip' for short video uploads
  const isVideoClip = type === 'video_clip'
  const isRaw = req.query?.resource_type === 'raw'
  const resourceType = isRaw ? 'raw' : (isVideoClip || req.query?.resource_type === 'video') ? 'video' : 'image'
  const folder = isRaw ? 'kaydo/encrypted' : isVideoClip ? 'kaydo/videos' : resourceType === 'video' ? 'kaydo/audio' : 'kaydo'
  const timestamp = Math.round(Date.now() / 1000)

  const signature = createHash('sha1')
    .update(`folder=${folder}&timestamp=${timestamp}${secret}`)
    .digest('hex')

  res.json({ timestamp, signature, folder, apiKey, resourceType })
}
