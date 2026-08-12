import { auth } from '../config/firebase'
import { getCurrentToken } from './notifications'

/**
 * Asks api/send-push to notify the family's other devices.
 *
 * This is what replaced the `notificationsQueue` collection and the Cloud
 * Function that drained it: the client triggers, the Vercel function sends.
 * Only a `kind` and structured parameters go over the wire — the wording is
 * built server-side (src/utils/pushMessages.js), so no encrypted memory content
 * ever leaves the app in a push payload.
 *
 * Fire-and-forget, like the queue write it replaces: a failed notification must
 * never fail the memory that triggered it.
 *
 * @param {'memory'|'moment'|'anniversary'} kind
 * @param {string} familyId
 * @param {object} [params] — { memoryId } or { count, year }
 */
export async function sendPush(kind, familyId, params = {}) {
  // Viewers have no Firebase session, so they cannot authorise a send. They
  // also never create anything, so there is nothing to announce.
  const user = auth?.currentUser
  if (!user || !familyId) return

  try {
    const idToken = await user.getIdToken()
    const res = await fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        familyId,
        kind,
        params,
        excludeToken: getCurrentToken(),
      }),
    })
    if (!res.ok && import.meta.env.DEV) {
      console.warn('[push] send failed', res.status, await res.text())
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[push] send failed', err)
  }
}
