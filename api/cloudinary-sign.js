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
function tokenVerifier() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID
  if (!projectId) return null
  return getAuth(getApps()[0] ?? initializeApp({ projectId }))
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

  // Set by the syncAdminClaims trigger. Viewers carry 'viewer', and an account
  // that belongs to no family carries nothing.
  if (claims.role !== 'admin') {
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
