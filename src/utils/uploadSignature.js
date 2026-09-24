import { auth } from '../config/firebase'

/**
 * Ask api/cloudinary-sign for upload credentials, as the signed-in admin.
 *
 * The endpoint signs only for a Firebase ID token carrying the admin role. A
 * new admin's role is written by a trigger a moment after they join, so the
 * token they signed in with may predate it — one forced refresh on a 403 picks
 * it up.
 *
 * @param {string} [query] e.g. '?resource_type=raw'
 * @returns {Promise<{ timestamp: number, signature: string, folder: string, apiKey: string }>}
 */
export async function fetchUploadSignature(query = '') {
  const user = auth?.currentUser
  if (!user) throw new Error('Sign in to upload')

  const ask = async (forceRefresh) =>
    fetch(`/api/cloudinary-sign${query}`, {
      headers: { Authorization: `Bearer ${await user.getIdToken(forceRefresh)}` },
    })

  let res = await ask(false)
  if (res.status === 403) res = await ask(true)
  if (!res.ok) throw new Error('Failed to get upload signature')
  return res.json()
}
