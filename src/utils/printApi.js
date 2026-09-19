/**
 * Calling the print endpoints from the browser.
 *
 * Every one of them verifies a Firebase ID token, so every call has to carry
 * one. Getting it right in one place matters more than it looks: a request that
 * forgets the header comes back 401, which reads like "you are logged out" and
 * sends people to the login screen they are already past.
 *
 * Tokens are fetched per request rather than cached. `getIdToken()` returns the
 * current one from memory and only goes to the network when it is close to
 * expiring, so this is cheap — and a cache of our own would be the thing that
 * eventually serves an expired token to the endpoint that places orders.
 */

import { ApiRequestError } from './printErrors'

async function authHeaders(user) {
  if (!user) throw new ApiRequestError('not_signed_in', 'Not signed in')
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function readError(response) {
  let body = null
  try {
    body = await response.json()
  } catch {
    // An endpoint that fell over before its own error handler — a 502 from the
    // platform, say — answers HTML. There is nothing to read out of it.
  }
  return new ApiRequestError(
    body?.error?.code || `http_${response.status}`,
    body?.error?.message || `Request failed (${response.status})`,
    response.status
  )
}

async function request(path, { user, method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    headers: await authHeaders(user),
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) throw await readError(response)
  return response.json()
}

/** What a book would cost, including shipping to `countryCode`. */
export function fetchQuote(user, { offeringId, quantity, pageCount, countryCode, currency = 'EUR' }) {
  return request('/api/print/quote', {
    user,
    method: 'POST',
    body: { offeringId, quantity, pageCount, countryCode, currency },
  })
}

/**
 * Place the order.
 *
 * `fileUrl` is the tokenised Storage URL the press will fetch. It travels to
 * our own endpoint and no further in this app — it is never written to
 * Firestore, because a document is read far more often than it is written and
 * that URL is a bearer capability over plaintext family photos.
 */
export function placeOrder(user, params) {
  return request('/api/print/order', { user, method: 'POST', body: params })
}

/** Where an order got to, as the print network sees it. */
export function fetchOrderStatus(user, orderReference) {
  return request(`/api/print/status?orderReference=${encodeURIComponent(orderReference)}`, { user })
}

/** The print network's catalogue. */
export function fetchOfferings(user) {
  return request('/api/print/offerings', { user })
}
