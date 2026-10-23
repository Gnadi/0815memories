/**
 * Upload signatures for Cloudinary — the first phase of
 * docs/plan-media-lifecycle.md.
 *
 * api/cloudinary-sign signed only `folder` and `timestamp`. Cloudinary accepts
 * a timestamp for an hour, so one signature allowed any number of uploads of
 * any resource type in that hour, and nothing recorded what was uploaded or for
 * whom. Here the server picks the file's `public_id` and signs it, so one
 * signature is one file, and it writes that file into the `mediaAssets` ledger
 * before the browser has sent a byte. Later phases attach ledger entries to the
 * documents that use them and delete the ones nothing uses; this one only makes
 * sure every new file is in the ledger.
 *
 * Nothing here imports firebase-admin or firebase-functions: Firestore, the
 * clock and the random source come in as arguments, so the tests can stub them.
 */
import { createHash, randomBytes } from 'node:crypto'

export const MEDIA_ASSETS = 'mediaAssets'

// What the browser may ask for. Family content is ciphertext, which Cloudinary
// cannot decode, so it goes up as `raw`. The exception is a picture shown
// without the family key — the login page's header above all (UploadWidget's
// `unencrypted`): a plain image, kept under its own prefix so it can never be
// mistaken for family content.
export const UPLOAD_KINDS = {
  encrypted: { resourceType: 'raw', prefix: 'kaydo' },
  public: { resourceType: 'image', prefix: 'kaydo/public' },
}

const FAMILY_ID = /^[A-Za-z0-9_-]{1,100}$/

export class SigningError extends Error {
  /** @param {'unauthenticated'|'invalid-argument'|'permission-denied'} code */
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

function adminUidsOf(data) {
  if (!data) return []
  const list = Array.isArray(data.adminUids) ? data.adminUids : []
  if (list.length > 0) return list
  return data.adminUid ? [data.adminUid] : []
}

/**
 * Cloudinary's signature: the parameters sorted by name, joined as
 * `key=value&…`, the API secret appended, SHA-1 in hex.
 * https://cloudinary.com/documentation/authentication_signatures
 */
export function cloudinarySignature(params, secret) {
  const joined = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  return createHash('sha1').update(`${joined}${secret}`).digest('hex')
}

/** Random, URL-safe, and long enough that nobody guesses another file's id. */
const defaultRandomId = () => randomBytes(16).toString('hex')

/**
 * Sign one upload for an admin of `data.familyId`, and record it as pending.
 *
 * The family comes from the browser — the one it is working in — and is
 * checked against the family document rather than the caller's claim, which
 * names only one family and may lag a moment behind a new admin. It has to be
 * the right family: a later phase deletes files that no document of their own
 * family uses.
 *
 * @param {{ db: any, apiKey: string, secret: string, now?: () => number, randomId?: () => string }} deps
 * @param {string|undefined} uid  the caller, from the verified ID token
 * @param {{ familyId?: unknown, kind?: unknown }} data
 * @returns {Promise<{ apiKey: string, signature: string, resourceType: string, publicId: string, params: Record<string, string|number> }>}
 */
export async function signUpload(deps, uid, data) {
  const { db, apiKey, secret, now = Date.now, randomId = defaultRandomId } = deps
  if (!uid) throw new SigningError('unauthenticated', 'Sign in first')

  const familyId = typeof data?.familyId === 'string' ? data.familyId : ''
  if (!FAMILY_ID.test(familyId)) throw new SigningError('invalid-argument', 'No family given')

  const kindName = data?.kind ?? 'encrypted'
  const kind = Object.hasOwn(UPLOAD_KINDS, kindName) ? UPLOAD_KINDS[kindName] : null
  if (!kind) throw new SigningError('invalid-argument', 'Unknown upload kind')

  const family = await db.doc(`families/${familyId}`).get()
  if (!family.exists || !adminUidsOf(family.data()).includes(uid)) {
    throw new SigningError('permission-denied', 'Only family admins can upload')
  }

  const assetId = randomId()
  const publicId = `${kind.prefix}/${familyId}/${assetId}`
  const createdAt = new Date(now())

  // Written before the signature leaves, so there is no file the ledger does
  // not know about. An entry whose upload never happens stays pending, and is
  // what the clean-up of abandoned uploads will remove.
  await db.collection(MEDIA_ASSETS).doc(assetId).set({
    familyId,
    uid,
    kind: kindName,
    publicId,
    resourceType: kind.resourceType,
    state: 'pending',
    refs: [],
    createdAt,
  })

  // Signed uploads overwrite by default, so `overwrite` is signed as false: a
  // second upload with the same signature lands on the same public_id and
  // stores nothing new. The tag lets Cloudinary's console and Admin API find a
  // family's files without the ledger.
  const params = {
    overwrite: 'false',
    public_id: publicId,
    tags: `family:${familyId}`,
    timestamp: Math.floor(createdAt.getTime() / 1000),
  }

  return {
    apiKey,
    signature: cloudinarySignature(params, secret),
    resourceType: kind.resourceType,
    publicId,
    params,
  }
}
