/**
 * Deciding whether a URL is a print file this caller is allowed to print.
 *
 * The order endpoint takes a file URL from the browser and hands it to a print
 * network that will fetch it. Taking that on trust would be three bugs at once:
 * a way to make the press print anything on the internet, a way to order
 * another family's book by pasting their URL, and a way to point a well-known
 * fetcher at a host of the caller's choosing.
 *
 * So the URL has to prove three things — it is in our bucket, it is under the
 * caller's own family, and it is a print file — and the family is taken from
 * the verified token, never from the request.
 */

import { badRequest, forbidden, misconfigured } from './http.js'

const STORAGE_HOST = 'firebasestorage.googleapis.com'

function expectedBucket() {
  const bucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET
  if (!bucket) throw misconfigured('FIREBASE_STORAGE_BUCKET is not set')
  return bucket
}

/**
 * The object path a Firebase Storage download URL points at, or null if the URL
 * is not one of ours.
 *
 * Download URLs look like
 *   https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encoded path>?alt=media&token=<uuid>
 * and the path is percent-encoded in a single segment.
 */
export function storagePathFromUrl(rawUrl, bucket) {
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }

  if (url.protocol !== 'https:') return null
  if (url.hostname !== STORAGE_HOST) return null

  const match = /^\/v0\/b\/([^/]+)\/o\/([^/?]+)$/.exec(url.pathname)
  if (!match) return null
  if (match[1] !== bucket) return null

  try {
    return decodeURIComponent(match[2])
  } catch {
    return null
  }
}

/**
 * Check that `fileUrl` is a print file belonging to `familyId`, and hand back
 * the object path so the caller can delete it once the order is placed.
 *
 * Throws with distinct codes on purpose: "this is not our file at all" and
 * "this is someone else's file" are different events, and only the second one
 * is worth looking at twice.
 */
export function assertOwnPrintFile(fileUrl, familyId) {
  if (!fileUrl || typeof fileUrl !== 'string') {
    throw badRequest('missing_file_url', 'No print file URL given')
  }

  const bucket = expectedBucket()
  const path = storagePathFromUrl(fileUrl, bucket)
  if (!path) {
    throw badRequest('foreign_file_url', 'Print file URL does not point at this project’s storage')
  }

  // Exactly printFiles/<familyId>/<scrapbookId>/<name>, matching storage.rules.
  // A prefix test alone would accept printFiles/<familyId>-evil/..., so the
  // family segment is compared whole.
  const segments = path.split('/')
  if (segments.length !== 4 || segments[0] !== 'printFiles') {
    throw badRequest('not_a_print_file', 'URL does not point at a print file')
  }
  if (segments[1] !== familyId) {
    throw forbidden('foreign_family_file', 'Print file belongs to another family')
  }

  return { path, scrapbookId: segments[2], fileName: segments[3] }
}
