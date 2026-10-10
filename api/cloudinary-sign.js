import { createHash } from 'crypto'

// A signature is permission to write to the Cloudinary account, so it is only
// handed to family admins — the only people the app lets upload anything. This
// endpoint used to sign for any caller, which made the account a free file host
// for anyone who found the URL.
//
// Who is a family admin is Firestore's answer, asked as the caller. The caller's
// ID token goes to Firestore's REST API with a query for their own family, and
// Firestore does the rest: it verifies the token — signature, expiry, project —
// and applies firestore.rules to the query, whose `list` rule on families admits
// exactly "the families that list me as an admin". A family in the answer means
// an admin; an empty answer means not one (viewers included: their uid is in no
// admin list); a refused token means not signed in.
//
// That is the test the rules apply to every write, and it holds for admins with
// a role claim and for those from before the claims alike. It also keeps this
// function free of dependencies. It used to verify tokens with firebase-admin,
// whose current release requires Node 22 — so whether uploads worked depended on
// the Node version the Vercel project happened to be set to.
const projectId = () => process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID

/**
 * The uid a Firebase ID token names. Read, not trusted: nothing is decided on it
 * until Firestore has verified the same token.
 */
function uidOf(idToken) {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'))
    const uid = payload.user_id ?? payload.sub
    return typeof uid === 'string' && uid ? uid : null
  } catch {
    return null
  }
}

// Firestore's auto-ids, and the hand-picked ids of seed data. Anything else
// stays out of a folder name.
const FAMILY_ID = /^[A-Za-z0-9_-]{1,100}$/

/** The family id at the end of a document name, `…/documents/families/<id>`. */
function familyIdOf(name) {
  const id = typeof name === 'string' ? name.split('/').pop() : ''
  return FAMILY_ID.test(id) ? id : null
}

/**
 * { status, familyId }: status is 'admin', 'not-admin', 'bad-token' (Firestore
 * refused the token), or 'unavailable' (Firestore could not be asked — never
 * read as a yes). familyId comes with 'admin'.
 *
 * Two lookups, the two shapes of a family document, as at sign-in: `adminUids`,
 * then the oldest families' lone `adminUid`. Only document names come back — the
 * family document also holds the encryption key.
 */
async function adminStatus(idToken, uid) {
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
    if (!response) return { status: 'unavailable' }
    if (response.status === 401) return { status: 'bad-token' }
    if (!response.ok) return { status: 'unavailable' }
    const rows = await response.json().catch(() => null)
    if (!Array.isArray(rows)) return { status: 'unavailable' }
    const row = rows.find((r) => r.document)
    if (row) return { status: 'admin', familyId: familyIdOf(row.document.name) }
  }
  return { status: 'not-admin' }
}

/**
 * Each family uploads into a folder of its own, kaydo/f/<familyId>/. The name is
 * what lets the purge function (functions/purge.js) tell this family's files
 * from another's without downloading them, before it deletes any. Files from
 * before the folders sit in kaydo/encrypted and kaydo/; the purge checks those
 * against the family key instead.
 */
function folderFor(familyId, { isRaw, isVideoClip, resourceType }) {
  const kind = isRaw ? 'encrypted' : isVideoClip ? 'videos' : resourceType === 'video' ? 'audio' : 'public'
  if (!familyId) {
    return isRaw ? 'kaydo/encrypted' : isVideoClip ? 'kaydo/videos' : resourceType === 'video' ? 'kaydo/audio' : 'kaydo'
  }
  return `kaydo/f/${familyId}/${kind}`
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  const secret = process.env.CLOUDINARY_API_SECRET
  const apiKey = process.env.CLOUDINARY_API_KEY

  if (!secret || !apiKey || !projectId()) {
    res.status(500).json({ error: 'Upload signing is not configured' })
    return
  }

  const bearer = /^Bearer (.+)$/.exec(req.headers?.authorization || '')?.[1]
  const uid = bearer ? uidOf(bearer) : null
  if (!uid) {
    res.status(401).json({ error: 'Sign in first' })
    return
  }

  const { status, familyId } = await adminStatus(bearer, uid)
  if (status === 'bad-token') {
    res.status(401).json({ error: 'Sign in first' })
    return
  }
  if (status === 'unavailable') {
    res.status(503).json({ error: 'Could not check your family right now' })
    return
  }
  if (status !== 'admin') {
    res.status(403).json({ error: 'Only family admins can upload' })
    return
  }

  const type = req.query?.type  // 'video_clip' for short video uploads
  const isVideoClip = type === 'video_clip'
  const isRaw = req.query?.resource_type === 'raw'
  const resourceType = isRaw ? 'raw' : (isVideoClip || req.query?.resource_type === 'video') ? 'video' : 'image'
  const folder = folderFor(familyId, { isRaw, isVideoClip, resourceType })
  const timestamp = Math.round(Date.now() / 1000)

  const signature = createHash('sha1')
    .update(`folder=${folder}&timestamp=${timestamp}${secret}`)
    .digest('hex')

  res.json({ timestamp, signature, folder, apiKey, resourceType })
}
