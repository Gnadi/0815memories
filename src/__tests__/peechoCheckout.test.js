/**
 * The Peecho checkout for a print file — functions/peechoCheckout.js.
 *
 * The request carries the merchant API key, so it is made on the server, and
 * only for an admin of the family whose print file it is. What goes to Peecho
 * is checked against Peecho's documented product-listing request.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  createCheckout,
  readCheckoutRequest,
  peechoExpiry,
  CheckoutError,
  CHECKOUT_VALID_DAYS,
  PEECHO_TEST,
  firebaseDownloadUrl,
} from '../../functions/peechoCheckout.js'
import { PRINT_FILE_RETENTION_DAYS } from '../../functions/printFiles.js'

const FAMILY = 'fam-1'
const PRINT_ID = '0b6e3c1e-6f7a-4c1e-9d2b-3a4b5c6d7e8f'
const ADMIN = 'uid-admin'
const NOW = Date.parse('2026-09-26T10:00:00Z')

const payload = (overrides = {}) => ({
  familyId: FAMILY,
  printId: PRINT_ID,
  pageCount: 24,
  widthMm: 297,
  heightMm: 210,
  currency: 'eur',
  language: 'de',
  title: 'Sommer 2026',
  ...overrides,
})

function deps({ adminUids = [ADMIN], files = ['book.pdf', 'cover.jpg'], response } = {}) {
  const existing = new Set(files.map((name) => `printFiles/${FAMILY}/${PRINT_ID}/${name}`))
  const fetch = vi.fn(async () => response ?? {
    ok: true,
    status: 200,
    json: async () => ({ secure_publication_id: 'dec27b95-d22d', token: '4b3345f7-bf70' }),
  })
  return {
    db: {
      doc: (path) => ({
        get: async () => (path === `families/${FAMILY}`
          ? { exists: true, data: () => ({ adminUids }) }
          : { exists: false, data: () => null }),
      }),
    },
    bucket: { file: (path) => ({ path, exists: async () => [existing.has(path)] }) },
    downloadUrl: async (file) => `https://storage.example/${encodeURIComponent(file.path)}?token=dl`,
    fetch,
    apiKey: 'MERCHANT-KEY',
    apiBase: PEECHO_TEST,
    now: () => NOW,
  }
}

describe('createCheckout', () => {
  it('creates a secure, expiring product listing for the family’s print file', async () => {
    const d = deps()
    const result = await createCheckout(d, ADMIN, payload())

    expect(d.fetch).toHaveBeenCalledTimes(1)
    const [url, init] = d.fetch.mock.calls[0]
    expect(url).toBe('https://test.www.peecho.com/rest/v3/publication/create')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      apiKey: 'MERCHANT-KEY',
      currency: 'EUR',
      locale: 'de',
      enableSecureCheckout: true,
      secureCheckoutExpirationDate: '03-10-2026 12:00:00',
      order: {
        reference: PRINT_ID,
        product: {
          title: 'Sommer 2026',
          source: {
            file: {
              src: `https://storage.example/${encodeURIComponent(`printFiles/${FAMILY}/${PRINT_ID}/book.pdf`)}?token=dl`,
              pages: 24,
              dimensions: { width: 297, height: 210 },
            },
          },
          thumbnail: { src: `https://storage.example/${encodeURIComponent(`printFiles/${FAMILY}/${PRINT_ID}/cover.jpg`)}?token=dl` },
        },
      },
    })
    expect(result).toEqual({
      checkoutUrl: 'https://test.www.peecho.com/checkout/print/de/dec27b95-d22d?token=4b3345f7-bf70',
      expiresAt: new Date(NOW + CHECKOUT_VALID_DAYS * 86400000).toISOString(),
    })
  })

  it('refuses anyone who is not an admin of the family, before asking Peecho', async () => {
    const d = deps({ adminUids: ['someone-else'] })
    await expect(createCheckout(d, ADMIN, payload())).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(createCheckout(d, undefined, payload())).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(createCheckout(deps(), ADMIN, payload({ familyId: 'other-family' })))
      .rejects.toMatchObject({ code: 'permission-denied' })
    expect(d.fetch).not.toHaveBeenCalled()
  })

  it('only lists a print file that is really in Storage', async () => {
    const d = deps({ files: [] })
    await expect(createCheckout(d, ADMIN, payload())).rejects.toMatchObject({ code: 'not-found' })
    expect(d.fetch).not.toHaveBeenCalled()
  })

  it('leaves the thumbnail out when there is no cover picture', async () => {
    const d = deps({ files: ['book.pdf'] })
    await createCheckout(d, ADMIN, payload())
    expect(JSON.parse(d.fetch.mock.calls[0][1].body).order.product).not.toHaveProperty('thumbnail')
  })

  it('reports Peecho refusing, without passing on what it said', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // What Peecho answers for an unknown key: a 500, not the documented 401.
    const d = deps({ response: { ok: false, status: 500, json: async () => ({ details: 'Merchant by merchantApiKey x not found' }) } })
    const error = await createCheckout(d, ADMIN, payload()).catch((e) => e)
    expect(error).toBeInstanceOf(CheckoutError)
    expect(error.code).toBe('unavailable')
    expect(error.message).not.toMatch(/merchantApiKey/)
  })

  it('is unavailable without an API key', async () => {
    await expect(createCheckout({ ...deps(), apiKey: '' }, ADMIN, payload())).rejects.toMatchObject({ code: 'unavailable' })
  })
})

describe('firebaseDownloadUrl', () => {
  const file = (tokens) => ({
    name: `printFiles/${FAMILY}/${PRINT_ID}/book.pdf`,
    bucket: { name: 'kaydo.firebasestorage.app' },
    getMetadata: async () => [{ metadata: tokens ? { firebaseStorageDownloadTokens: tokens } : {} }],
  })

  it('is the link the upload got, as getDownloadURL builds it', async () => {
    expect(await firebaseDownloadUrl(file('tok-1,tok-2'))).toBe(
      `https://firebasestorage.googleapis.com/v0/b/kaydo.firebasestorage.app/o/printFiles%2F${FAMILY}%2F${PRINT_ID}%2Fbook.pdf?alt=media&token=tok-1`,
    )
    expect(await firebaseDownloadUrl(file('tok-1'), '127.0.0.1:9199')).toMatch(/^http:\/\/127\.0\.0\.1:9199\/v0\/b\//)
  })

  it('refuses a file that has no download token', async () => {
    await expect(firebaseDownloadUrl(file(null))).rejects.toMatchObject({ code: 'not-found' })
  })
})

describe('readCheckoutRequest', () => {
  it('refuses ids that could reach outside the print folder', () => {
    for (const bad of [{ printId: '../x' }, { printId: 'abc' }, { familyId: 'a/b' }, { familyId: '' }]) {
      expect(() => readCheckoutRequest(payload(bad)), JSON.stringify(bad)).toThrow(CheckoutError)
    }
  })

  it('wants an even page count and a sensible size', () => {
    expect(() => readCheckoutRequest(payload({ pageCount: 23 }))).toThrow(/even/)
    expect(() => readCheckoutRequest(payload({ pageCount: 0 }))).toThrow()
    expect(() => readCheckoutRequest(payload({ widthMm: 5 }))).toThrow(/size/)
  })

  it('falls back to euros, English and a default title', () => {
    const request = readCheckoutRequest(payload({ currency: 'euro', language: 'fr', title: '  ' }))
    expect(request).toMatchObject({ currency: 'EUR', locale: 'en', title: 'Kaydo scrapbook' })
  })
})

describe('peechoExpiry', () => {
  it('writes Peecho’s CET format, summer time included', () => {
    expect(peechoExpiry(new Date('2026-01-15T12:00:00Z'))).toBe('15-01-2026 13:00:00')
    expect(peechoExpiry(new Date('2026-07-15T12:00:00Z'))).toBe('15-07-2026 14:00:00')
  })

  it('closes the checkout well before the print file is deleted', () => {
    expect(CHECKOUT_VALID_DAYS).toBeLessThan(PRINT_FILE_RETENTION_DAYS)
  })
})
