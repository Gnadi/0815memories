/**
 * The Peecho adapter.
 *
 * Everything Peecho-shaped lives in this file — the base URL, the endpoint
 * paths, the payload nesting, the way errors come back — so that swapping to
 * Prodigi later is writing a sibling of this file rather than editing routes.
 * The routes above it only know the vocabulary in `printProvider.js`.
 *
 * ── A warning about the payload shapes below ─────────────────────────────────
 *
 * Peecho's official API reference is not publicly reachable from where this was
 * written, so the field names and nesting here are assembled from Peecho's own
 * blog walkthrough, their knowledge base and a third-party integration guide.
 * They are the best available reading, not a copy of the spec, and the pieces
 * most likely to be wrong are marked UNVERIFIED.
 *
 * Do not guess at them further. Run `GET /api/print/selftest` with a real
 * merchant key: it calls each endpoint and reports exactly what Peecho said,
 * which settles the question in one request. The constants are gathered at the
 * top of the file precisely so that correcting them is a small, obvious edit.
 */

import { ApiError, misconfigured } from './http.js'

/**
 * Peecho runs a separate test environment on its own hostname, with its own
 * merchant key and test credit cards. Orders placed there never reach a press.
 * Defaulting to test is the safe default for a service that spends money: going
 * live has to be a deliberate act, not the absence of configuration.
 */
const BASE_URLS = {
  test: 'https://test.www.peecho.com/rest/v3',
  live: 'https://www.peecho.com/rest/v3',
}

/** UNVERIFIED — confirm each against /api/print/selftest before going live. */
const ENDPOINTS = {
  offerings: '/offering',
  price: '/price',
  order: '/order',
  orderStatus: '/order/status',
}

const REQUEST_TIMEOUT_MS = 20000

function config() {
  const apiKey = process.env.PEECHO_MERCHANT_API_KEY
  if (!apiKey) throw misconfigured('PEECHO_MERCHANT_API_KEY is not set')

  // Anything other than an explicit "live" stays on the test environment.
  const mode = process.env.PEECHO_MODE === 'live' ? 'live' : 'test'
  return { apiKey, mode, baseUrl: BASE_URLS[mode] }
}

/** What environment we are talking to, for the client to display. Never the key. */
export function describeConfig() {
  const { mode, baseUrl } = config()
  return { provider: 'peecho', mode, baseUrl }
}

/**
 * One request to Peecho.
 *
 * The merchant key goes in the JSON body rather than a header — that is Peecho's
 * design, not ours — which is the single reason none of this can run in the
 * browser: a key in a request body is a key in the bundle.
 */
async function peechoRequest(path, body = {}, { method = 'POST' } = {}) {
  const { apiKey, baseUrl } = config()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response
  let text
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ merchant_api_key: apiKey, ...body }),
      signal: controller.signal,
    })
    text = await response.text()
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new ApiError(504, 'provider_timeout', 'The print network did not answer in time')
    }
    throw new ApiError(502, 'provider_unreachable', 'Could not reach the print network', err?.message)
  } finally {
    clearTimeout(timer)
  }

  let parsed = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    // Peecho answers HTML on some failures (a login page, a gateway error).
    // Keeping the raw text only in the log matters: it can echo the request,
    // and the request carries the merchant key.
    if (!response.ok) {
      throw new ApiError(502, 'provider_error', 'The print network returned an unreadable response', text?.slice(0, 500))
    }
  }

  if (!response.ok) {
    const message = parsed?.message || parsed?.error || `Print network responded ${response.status}`
    throw new ApiError(
      response.status === 401 || response.status === 403 ? 502 : 502,
      'provider_rejected',
      message,
      JSON.stringify(parsed)?.slice(0, 500)
    )
  }

  return parsed
}

// ─── Payload building (pure, so it can be tested without a network) ──────────

/**
 * The order payload.
 *
 * UNVERIFIED nesting. The reading these names come from is:
 *   { merchant_api_key, purchase_order: { currency, order_reference,
 *     item_details: [ { item_reference, offering_id, quantity,
 *                       file_details: { content_url, pages, width, height } } ],
 *     address_details: { ... } } }
 *
 * `order_reference` is ours to choose and is what ties a Peecho order back to a
 * row in Firestore, so it must be stable and unique per order — never the
 * scrapbook id, which would collide the moment a family orders a second copy.
 */
export function buildOrderPayload({
  orderReference,
  offeringId,
  quantity,
  currency,
  fileUrl,
  pageCount,
  widthMm,
  heightMm,
  address,
}) {
  return {
    purchase_order: {
      currency,
      order_reference: orderReference,
      item_details: [
        {
          item_reference: orderReference,
          offering_id: offeringId,
          quantity,
          file_details: {
            content_url: fileUrl,
            pages: pageCount,
            width: widthMm,
            height: heightMm,
          },
        },
      ],
      address_details: buildAddressPayload(address),
    },
  }
}

/**
 * UNVERIFIED field names. Kept separate from the order payload because this is
 * the part most likely to need correcting, and because it is the part carrying
 * a real person's home address — worth being able to read at a glance.
 */
export function buildAddressPayload(address = {}) {
  return {
    name: address.name,
    address_line_1: address.line1,
    address_line_2: address.line2 || '',
    postal_code: address.postalCode,
    city: address.city,
    state: address.state || '',
    country_code: address.countryCode,
    email: address.email,
    telephone: address.phone || '',
  }
}

/**
 * The fields an address must carry before it is worth sending anywhere.
 *
 * Checked here rather than at the press: a rejected order that has already been
 * paid for is a refund and an apology, while a rejected form is a red field.
 */
export function validateAddress(address) {
  const required = ['name', 'line1', 'postalCode', 'city', 'countryCode', 'email']
  const missing = required.filter((field) => !String(address?.[field] || '').trim())
  if (missing.length) {
    throw new ApiError(400, 'incomplete_address', `Address is missing: ${missing.join(', ')}`)
  }
  if (!/^[A-Z]{2}$/.test(String(address.countryCode))) {
    throw new ApiError(400, 'invalid_country', 'Country must be a two-letter ISO code')
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(address.email))) {
    throw new ApiError(400, 'invalid_email', 'Email address is not valid')
  }
  return true
}

// ─── Operations ──────────────────────────────────────────────────────────────

/** The catalogue: which products exist, at what sizes, with what page limits. */
export async function listOfferings() {
  return peechoRequest(ENDPOINTS.offerings, {})
}

/** What one order would cost, including shipping to `countryCode`. */
export async function calculatePrice({ offeringId, quantity, pageCount, countryCode, currency }) {
  return peechoRequest(ENDPOINTS.price, {
    offering_id: offeringId,
    quantity,
    pages: pageCount,
    country_code: countryCode,
    currency,
  })
}

/** Place the order. */
export async function createOrder(params) {
  validateAddress(params.address)
  return peechoRequest(ENDPOINTS.order, buildOrderPayload(params))
}

/** Where an order has got to. */
export async function getOrderStatus(orderReference) {
  return peechoRequest(ENDPOINTS.orderStatus, { order_reference: orderReference })
}

/**
 * Call every endpoint and report what came back, without throwing.
 *
 * This exists because the payload shapes above are a reading rather than a
 * spec. One run with a real key replaces all the guessing: each entry says
 * whether Peecho accepted the call and, when it did not, exactly what it
 * objected to.
 */
export async function selfTest() {
  const probes = [
    ['offerings', () => listOfferings()],
    ['price', () => calculatePrice({ offeringId: null, quantity: 1, pageCount: 24, countryCode: 'DE', currency: 'EUR' })],
    ['orderStatus', () => getOrderStatus('selftest-nonexistent')],
  ]

  const results = {}
  for (const [name, run] of probes) {
    try {
      const data = await run()
      results[name] = { ok: true, endpoint: ENDPOINTS[name] || ENDPOINTS.orderStatus, sample: truncate(data) }
    } catch (err) {
      results[name] = {
        ok: false,
        endpoint: ENDPOINTS[name] || ENDPOINTS.orderStatus,
        code: err?.code || 'unknown',
        message: err?.message,
        // Peecho's own words, which is the whole point of running this.
        detail: typeof err?.detail === 'string' ? err.detail.slice(0, 800) : undefined,
      }
    }
  }
  return results
}

/** Keep a catalogue response readable in a terminal without losing its shape. */
function truncate(value) {
  const json = JSON.stringify(value)
  if (!json) return value
  return json.length > 2000 ? `${json.slice(0, 2000)}… (${json.length} bytes total)` : value
}
