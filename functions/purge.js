/**
 * Deleting for good: the trash entries whose time is up, with the Cloudinary
 * files they list, and the files deletion requests ask for
 * (src/services/trash.js, src/services/mediaDeletions.js).
 *
 * Those lists come from clients, and a client can name any file — a former
 * member of one family can keep its file names and start a family of their
 * own. So before deleting a file, this makes sure it is the family's:
 *
 *   - it is in the family's own folder, kaydo/f/<familyId>/, which only an
 *     upload signed for that family can write to (api/cloudinary-sign.js); or
 *   - it is from before the folders, and it decrypts with the family's key.
 *     AES-GCM refuses any other key. What it decrypts to is thrown away
 *     unread: the question is only whether the key fits.
 *
 * A file that is neither stays where it is.
 *
 * Nothing here imports firebase-admin: the Firestore instance, fetch and the
 * Cloudinary credentials come in as arguments, so the test suite can run it.
 */
import { createDecipheriv } from 'node:crypto'

/** Mirrored by TRASH_DAYS in src/services/trash.js, which tells the family. */
export const TRASH_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

// As src/utils/encryption.js writes a file: IV, ciphertext, then the GCM tag.
const IV_LENGTH = 12
const TAG_LENGTH = 16

// The Admin API takes this many files per deletion.
const DELETE_CHUNK = 100

// Where uploads go since the folders (api/cloudinary-sign.js), one per family.
const FAMILY_FOLDERS = 'kaydo/f/'

/** A family's own folder. */
export const familyFolder = (familyId) => `${FAMILY_FOLDERS}${familyId}/`

/**
 * { resourceType, publicId } for a file on this Cloudinary account, or null.
 * The URLs are Cloudinary's own secure_url: https://res.cloudinary.com/<cloud>/
 * <type>/upload/v<version>/<public id>. A raw file's public id keeps its
 * extension; an image's or a video's does not.
 */
export function cloudinaryAsset(url, cloudName) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') return null
  const parts = parsed.pathname.split('/').filter(Boolean)
  const [cloud, resourceType, delivery, ...rest] = parts
  if (cloud !== cloudName || delivery !== 'upload') return null
  if (!['raw', 'image', 'video'].includes(resourceType)) return null
  const path = /^v\d+$/.test(rest[0] ?? '') ? rest.slice(1) : rest
  if (!path.length) return null
  let publicId = path.map(decodeURIComponent).join('/')
  if (resourceType !== 'raw') publicId = publicId.replace(/\.[^/.]+$/, '')
  return { resourceType, publicId, url }
}

/** Every Cloudinary URL anywhere in a document's fields. */
export function mediaIn(value, found = new Set()) {
  if (typeof value === 'string') {
    if (value.startsWith('https://res.cloudinary.com/')) found.add(value)
  } else if (Array.isArray(value)) {
    for (const item of value) mediaIn(item, found)
  } else if (value && typeof value === 'object' && typeof value.toDate !== 'function') {
    for (const item of Object.values(value)) mediaIn(item, found)
  }
  return found
}

/** The family's AES key, from the JWK the family document holds. */
export function rawKey(jwk) {
  if (!jwk || jwk.kty !== 'oct' || typeof jwk.k !== 'string') return null
  const key = Buffer.from(jwk.k, 'base64url')
  return key.length === 32 ? key : null
}

/** Whether `key` is the key these bytes were encrypted with. */
export function sealedWith(bytes, key) {
  if (!key || !bytes || bytes.length < IV_LENGTH + TAG_LENGTH) return false
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, IV_LENGTH))
    decipher.setAuthTag(bytes.subarray(bytes.length - TAG_LENGTH))
    decipher.update(bytes.subarray(IV_LENGTH, bytes.length - TAG_LENGTH))
    decipher.final()
    return true
  } catch {
    return false
  }
}

/**
 * Of `urls`, the files that are this family's, to delete; and the ones that
 * are not, which stay. A file that is already gone is in neither.
 *
 * `fetchBytes(url)` downloads a file, or answers null when it is gone.
 */
export async function familyFiles(urls, { familyId, key, cloudName, fetchBytes }) {
  const owned = []
  const refused = []
  for (const url of new Set(urls)) {
    const asset = cloudinaryAsset(url, cloudName)
    if (!asset) {
      refused.push(url)
    } else if (asset.publicId.startsWith(familyFolder(familyId))) {
      owned.push(asset)
    } else if (asset.publicId.startsWith(FAMILY_FOLDERS)) {
      // Another family's folder, which only that family's uploads go to.
      refused.push(url)
    } else if (asset.resourceType === 'raw' && key) {
      const bytes = await fetchBytes(url)
      if (bytes === null) continue
      if (sealedWith(bytes, key)) owned.push(asset)
      else refused.push(url)
    } else {
      refused.push(url)
    }
  }
  return { owned, refused }
}

const basicAuth = ({ apiKey, apiSecret }) =>
  `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`

/**
 * Deletes files on Cloudinary through the Admin API, a hundred per call. A
 * file that is already gone counts as deleted; a refused call throws, so the
 * caller keeps its record and tries again on the next run.
 */
export async function deleteFiles(assets, cloudinary) {
  const byType = new Map()
  for (const asset of assets) {
    if (!byType.has(asset.resourceType)) byType.set(asset.resourceType, [])
    byType.get(asset.resourceType).push(asset.publicId)
  }
  for (const [resourceType, publicIds] of byType) {
    for (let i = 0; i < publicIds.length; i += DELETE_CHUNK) {
      const params = new URLSearchParams()
      for (const id of publicIds.slice(i, i + DELETE_CHUNK)) params.append('public_ids[]', id)
      const response = await cloudinary.fetch(
        `https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/resources/${resourceType}/upload?${params}`,
        { method: 'DELETE', headers: { Authorization: basicAuth(cloudinary) } },
      )
      if (!response.ok) throw new Error(`Cloudinary refused to delete (${response.status})`)
    }
  }
}

/**
 * Deletes every file under `prefix`, whatever references them or not: a whole
 * family's folder. The Admin API takes up to a thousand per call and says
 * `partial` while there are more.
 */
export async function deleteFolder(prefix, cloudinary) {
  for (const resourceType of ['raw', 'image', 'video']) {
    for (let round = 0; round < 100; round++) {
      const response = await cloudinary.fetch(
        `https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/resources/${resourceType}/upload?${new URLSearchParams({ prefix })}`,
        { method: 'DELETE', headers: { Authorization: basicAuth(cloudinary) } },
      )
      if (!response.ok) throw new Error(`Cloudinary refused to delete ${prefix} (${response.status})`)
      const body = await response.json().catch(() => ({}))
      if (!body.partial) break
    }
  }
}

/**
 * The family's key, for the files from before the folders. A family being
 * deleted has handed its key to its deletion (functions/familyDeletion.js)
 * until the last file is gone.
 */
export function familyKeys(db) {
  const cache = new Map()
  return (familyId) => {
    if (!cache.has(familyId)) {
      cache.set(familyId, (async () => {
        const family = await db.doc(`families/${familyId}`).get()
        const jwk = family.exists ? family.data().encryptionKeyJwk : null
        if (jwk) return rawKey(jwk)
        const deletion = await db.doc(`familyDeletions/${familyId}`).get()
        return deletion.exists ? rawKey(deletion.data().key) : null
      })())
    }
    return cache.get(familyId)
  }
}

/**
 * One trash entry, for good: its files, a capsule's sealed letter with the
 * letter's files, then the entry. Throws, and leaves the entry, if Cloudinary
 * cannot be reached — it is tried again on the next run.
 */
export async function purgeTrashEntry(entry, { db, keyOf, fetchBytes, cloudinary }) {
  const { familyId } = entry
  const urls = [...(Array.isArray(entry.media) ? entry.media : [])]

  // The letter stayed behind, sealed, when the capsule went to the trash. Its
  // files are named in clear on it; the client could not read them.
  let letter = null
  if (entry.collection === 'blackbox') {
    const snap = await db.doc(`blackboxContent/${entry.docId}`).get()
    if (snap.exists && snap.data().familyId === familyId) {
      letter = snap
      urls.push(...mediaIn(snap.data()))
    }
  }

  const { owned, refused } = await familyFiles(urls, {
    familyId, key: await keyOf(familyId), cloudName: cloudinary.cloudName, fetchBytes,
  })
  await deleteFiles(owned, cloudinary)
  if (letter) await letter.ref.delete()
  await db.doc(`trash/${entry.id}`).delete()
  return { files: owned.length, refused }
}

/** One deletion request: its files, then the request. */
export async function purgeRequest(request, { db, keyOf, fetchBytes, cloudinary }) {
  const { owned, refused } = await familyFiles(request.media ?? [], {
    familyId: request.familyId, key: await keyOf(request.familyId), cloudName: cloudinary.cloudName, fetchBytes,
  })
  await deleteFiles(owned, cloudinary)
  await db.doc(`mediaDeletions/${request.id}`).delete()
  return { files: owned.length, refused }
}

/**
 * Everything that is due: trash entries past TRASH_DAYS or deleted for good,
 * and every deletion request. Each one stands alone, so one that fails stays
 * for the next run without holding up the rest, as does whatever is left when
 * `deadline` comes.
 */
export async function purgeDue({
  db, now = Date.now(), fetchBytes, cloudinary, limit = 200, deadline = Infinity, log = () => {},
}) {
  const cutoff = new Date(now - TRASH_DAYS * DAY_MS)
  const [expired, forever, requests] = await Promise.all([
    db.collection('trash').where('deletedAt', '<=', cutoff).limit(limit).get(),
    db.collection('trash').where('purgeNow', '==', true).limit(limit).get(),
    db.collection('mediaDeletions').limit(limit).get(),
  ])
  const entries = new Map()
  for (const doc of [...expired.docs, ...forever.docs]) entries.set(doc.id, { id: doc.id, ...doc.data() })

  const deps = { db, keyOf: familyKeys(db), fetchBytes, cloudinary }
  const totals = { entries: 0, requests: 0, files: 0, refused: 0, failed: 0 }
  const tally = (result) => {
    totals.files += result.files
    totals.refused += result.refused.length
    if (result.refused.length) log('refused', result.refused)
  }
  for (const entry of entries.values()) {
    if (Date.now() > deadline) break
    try {
      tally(await purgeTrashEntry(entry, deps))
      totals.entries++
    } catch (err) {
      totals.failed++
      log('failed', entry.id, err)
    }
  }
  for (const doc of requests.docs) {
    if (Date.now() > deadline) break
    try {
      tally(await purgeRequest({ id: doc.id, ...doc.data() }, deps))
      totals.requests++
    } catch (err) {
      totals.failed++
      log('failed', doc.id, err)
    }
  }
  return totals
}

/** fetchBytes for the real thing: a file's bytes, or null once it is gone. */
export function downloader(fetchImpl) {
  return async (url) => {
    const response = await fetchImpl(url)
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`Could not download ${url} (${response.status})`)
    return Buffer.from(await response.arrayBuffer())
  }
}
