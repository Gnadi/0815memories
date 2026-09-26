/**
 * A Peecho checkout for one print file.
 *
 * Peecho's hosted checkout sells a "product listing" (publication): the file,
 * its page count and size. We create one per print file through Peecho's API
 * and hand the admin its secure checkout link — private to whoever holds the
 * token, and expiring. At the checkout the customer picks the product, enters
 * the address and pays Peecho; prices are Peecho's plus the markup set in the
 * Peecho account. No money passes through Kaydo.
 *
 * This runs on the server because creating a listing takes the merchant API
 * key. It also builds the file links itself, from Storage, rather than taking
 * them from the browser: a listing can only ever point at a print file of a
 * family the caller is an admin of.
 *
 * Nothing here imports firebase-admin or firebase-functions: Firestore, the
 * bucket, fetch and the clock come in as arguments, so the tests can stub them.
 *
 * API: POST {base}/rest/v3/publication/create — https://peechoapiv3.docs.apiary.io
 */
import { PRINT_FILE_RETENTION_DAYS } from './printFiles.js'

export const PEECHO_PROD = 'https://www.peecho.com'
export const PEECHO_TEST = 'https://test.www.peecho.com'

/**
 * How long a checkout link works. Well inside the time the print file is kept,
 * so nobody can order a book whose file is about to be deleted.
 */
export const CHECKOUT_VALID_DAYS = 7
if (CHECKOUT_VALID_DAYS >= PRINT_FILE_RETENTION_DAYS) {
  throw new Error('A checkout must expire before its print file is deleted')
}

const FAMILY_ID = /^[A-Za-z0-9_-]{1,100}$/
const PRINT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const CURRENCY = /^[A-Z]{3}$/
const DAY_MS = 24 * 60 * 60 * 1000

export class CheckoutError extends Error {
  /** @param {'invalid-argument'|'permission-denied'|'not-found'|'unavailable'} code */
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

/** Peecho reads the expiry as CET/CEST wall-clock time, 'dd-MM-yyyy HH:mm:ss'. */
export function peechoExpiry(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Amsterdam',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date).map(({ type, value }) => [type, value]),
  )
  return `${parts.day}-${parts.month}-${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`
}

/**
 * The download URL the app's own upload got for `file` — the one link Peecho
 * can fetch it by. Built from the token in the object's metadata, read over
 * the Cloud Storage API as the function's service account. firebase-admin's
 * getDownloadURL() reads the same token through the Firebase Storage API
 * instead, which answers to storage.rules and so refuses the emulator's
 * unauthenticated admin client; this way works the same in both.
 *
 * @param {{ name: string, bucket: { name: string }, getMetadata: () => Promise<[any]> }} file
 * @param {string} [emulatorHost]  FIREBASE_STORAGE_EMULATOR_HOST
 */
export async function firebaseDownloadUrl(file, emulatorHost) {
  const [metadata] = await file.getMetadata()
  const token = String(metadata?.metadata?.firebaseStorageDownloadTokens ?? '').split(',')[0]
  if (!token) throw new CheckoutError('not-found', 'Print file has no download link')
  const base = emulatorHost ? `http://${emulatorHost}` : 'https://firebasestorage.googleapis.com'
  return `${base}/v0/b/${file.bucket.name}/o/${encodeURIComponent(file.name)}?alt=media&token=${encodeURIComponent(token)}`
}

/** What the browser sent, checked. Throws CheckoutError('invalid-argument'). */
export function readCheckoutRequest(data) {
  const familyId = String(data?.familyId ?? '')
  const printId = String(data?.printId ?? '')
  const pages = Number(data?.pageCount)
  const widthMm = Number(data?.widthMm)
  const heightMm = Number(data?.heightMm)
  const currency = String(data?.currency ?? '').toUpperCase()
  const title = String(data?.title ?? '').trim().slice(0, 100)
  const size = (mm) => Number.isFinite(mm) && mm >= 50 && mm <= 1000

  if (!FAMILY_ID.test(familyId) || !PRINT_ID.test(printId)) {
    throw new CheckoutError('invalid-argument', 'Unknown print file')
  }
  // printSequence always makes an even count, as Peecho requires.
  if (!Number.isInteger(pages) || pages < 2 || pages > 1000 || pages % 2 !== 0) {
    throw new CheckoutError('invalid-argument', 'Page count must be even')
  }
  if (!size(widthMm) || !size(heightMm)) throw new CheckoutError('invalid-argument', 'Unsupported page size')
  return {
    familyId,
    printId,
    pages,
    widthMm,
    heightMm,
    currency: CURRENCY.test(currency) ? currency : 'EUR',
    locale: String(data?.language ?? '').toLowerCase().startsWith('de') ? 'de' : 'en',
    title: title || 'Kaydo scrapbook',
  }
}

/**
 * @param {object} deps
 * @param {import('firebase-admin/firestore').Firestore} deps.db
 * @param {{ file: (path: string) => { exists: () => Promise<[boolean]> } }} deps.bucket
 * @param {(file: object) => Promise<string>} deps.downloadUrl  firebaseDownloadUrl
 * @param {typeof fetch} deps.fetch
 * @param {string} deps.apiKey   Peecho merchant API key
 * @param {string} deps.apiBase  PEECHO_PROD or PEECHO_TEST
 * @param {() => number} [deps.now]
 * @param {string|undefined} uid  the caller
 * @param {unknown} data          the callable's payload
 * @returns {Promise<{ checkoutUrl: string, expiresAt: string }>}
 */
export async function createCheckout(deps, uid, data) {
  const { db, bucket, downloadUrl, fetch, apiKey, apiBase, now = Date.now } = deps
  if (!apiKey) throw new CheckoutError('unavailable', 'Printing is not set up')
  const request = readCheckoutRequest(data)

  // adminUids on the document, not the caller's claim: it is the source of
  // truth, and correct even before the claim trigger has caught up.
  const family = await db.doc(`families/${request.familyId}`).get()
  if (!uid || !family.exists || !adminUidsOf(family.data()).includes(uid)) {
    throw new CheckoutError('permission-denied', 'Not an admin of this family')
  }

  const folder = `printFiles/${request.familyId}/${request.printId}`
  const pdf = bucket.file(`${folder}/book.pdf`)
  const [pdfExists] = await pdf.exists()
  if (!pdfExists) throw new CheckoutError('not-found', 'Print file not found')
  const cover = bucket.file(`${folder}/cover.jpg`)
  const [coverExists] = await cover.exists()

  const expires = new Date(now() + CHECKOUT_VALID_DAYS * DAY_MS)
  const body = {
    apiKey,
    currency: request.currency,
    locale: request.locale,
    enableSecureCheckout: true,
    secureCheckoutExpirationDate: peechoExpiry(expires),
    order: {
      // Every order from this listing carries it: the way back from an order
      // in the Peecho dashboard to its folder in Storage.
      reference: request.printId,
      product: {
        title: request.title,
        source: {
          file: {
            src: await downloadUrl(pdf),
            pages: request.pages,
            dimensions: { width: request.widthMm, height: request.heightMm },
          },
        },
        ...(coverExists ? { thumbnail: { src: await downloadUrl(cover) } } : {}),
      },
    },
  }

  const response = await fetch(`${apiBase}/rest/v3/publication/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => null)
  const answer = response ? await response.json().catch(() => null) : null
  if (!response?.ok || !answer?.secure_publication_id || !answer?.token) {
    // Peecho's own words, for the function log; never the key.
    console.error(`[print] Peecho refused the listing: ${response?.status} ${JSON.stringify(answer?.details ?? answer)}`)
    throw new CheckoutError('unavailable', 'Peecho did not create a checkout')
  }

  const id = encodeURIComponent(answer.secure_publication_id)
  const token = encodeURIComponent(answer.token)
  return {
    checkoutUrl: `${apiBase}/checkout/print/${request.locale}/${id}?token=${token}`,
    expiresAt: expires.toISOString(),
  }
}
