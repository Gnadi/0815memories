// @vitest-environment node
/**
 * Tests for the print endpoints' guards and payloads.
 *
 * These are the pieces that decide who may spend money and what gets sent to a
 * press, so they are tested as logic rather than exercised through a live
 * deployment: the URL check that keeps one family from ordering another's book,
 * the token check that keeps a viewer from ordering at all, and the payload
 * builders whose field names are the part most likely to need correcting once
 * the live API has spoken.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { storagePathFromUrl, assertOwnPrintFile } from '../../api/_lib/printFileUrl.js'
import {
  buildOrderPayload,
  buildAddressPayload,
  validateAddress,
} from '../../api/_lib/peecho.js'
import { ApiError } from '../../api/_lib/http.js'

const BUCKET = 'kaydo-test.appspot.com'
const FAMILY = 'family-1'

const urlFor = (path, bucket = BUCKET) =>
  `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=abc-123`

beforeEach(() => {
  globalThis.process.env.FIREBASE_STORAGE_BUCKET = BUCKET
})

describe('storagePathFromUrl', () => {
  it('decodes the object path out of a download URL', () => {
    expect(storagePathFromUrl(urlFor('printFiles/family-1/book-1/x.pdf'), BUCKET))
      .toBe('printFiles/family-1/book-1/x.pdf')
  })

  it('rejects another project’s bucket', () => {
    expect(storagePathFromUrl(urlFor('printFiles/family-1/book-1/x.pdf', 'someone-else.appspot.com'), BUCKET))
      .toBeNull()
  })

  it('rejects a host that merely looks like storage', () => {
    const evil = `https://firebasestorage.googleapis.com.attacker.example/v0/b/${BUCKET}/o/x.pdf`
    expect(storagePathFromUrl(evil, BUCKET)).toBeNull()
  })

  it('rejects plain http', () => {
    expect(storagePathFromUrl(urlFor('printFiles/a/b/c.pdf').replace('https:', 'http:'), BUCKET)).toBeNull()
  })

  it('rejects anything that is not a URL at all', () => {
    expect(storagePathFromUrl('not a url', BUCKET)).toBeNull()
    expect(storagePathFromUrl('', BUCKET)).toBeNull()
  })
})

describe('assertOwnPrintFile', () => {
  it('accepts this family’s own print file and reports its path', () => {
    const result = assertOwnPrintFile(urlFor('printFiles/family-1/book-7/uuid.pdf'), FAMILY)
    expect(result).toEqual({
      path: 'printFiles/family-1/book-7/uuid.pdf',
      scrapbookId: 'book-7',
      fileName: 'uuid.pdf',
    })
  })

  it('refuses another family’s print file, which is the attack it exists for', () => {
    // Someone who learns a neighbouring family's download URL must not be able
    // to have their book printed and shipped to an address of their choosing.
    expect(() => assertOwnPrintFile(urlFor('printFiles/family-2/book-1/uuid.pdf'), FAMILY))
      .toThrow(/another family/i)
  })

  it('refuses a family id that merely starts the same', () => {
    expect(() => assertOwnPrintFile(urlFor('printFiles/family-12/book-1/uuid.pdf'), 'family-1'))
      .toThrow(/another family/i)
  })

  it('refuses a URL pointing anywhere else in the bucket', () => {
    expect(() => assertOwnPrintFile(urlFor('somethingElse/family-1/x.pdf'), FAMILY))
      .toThrow(/not point at a print file/i)
  })

  it('refuses a deeper path that smuggles extra segments', () => {
    expect(() => assertOwnPrintFile(urlFor('printFiles/family-1/book-1/sub/x.pdf'), FAMILY))
      .toThrow(/not point at a print file/i)
  })

  it('refuses an arbitrary external URL, so the press cannot be aimed at it', () => {
    expect(() => assertOwnPrintFile('https://attacker.example/evil.pdf', FAMILY))
      .toThrow(/does not point at this project/i)
  })

  it('refuses a missing URL', () => {
    expect(() => assertOwnPrintFile(undefined, FAMILY)).toThrow(/No print file URL/i)
  })
})

describe('validateAddress', () => {
  const good = {
    name: 'Familie Muster',
    line1: 'Beispielweg 1',
    postalCode: '80331',
    city: 'München',
    countryCode: 'DE',
    email: 'familie@example.com',
  }

  it('accepts a complete address', () => {
    expect(validateAddress(good)).toBe(true)
  })

  it('names every missing field at once rather than one per round trip', () => {
    try {
      validateAddress({ name: 'X' })
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect(err.message).toMatch(/line1/)
      expect(err.message).toMatch(/postalCode/)
      expect(err.message).toMatch(/email/)
    }
  })

  it('treats whitespace as missing', () => {
    expect(() => validateAddress({ ...good, city: '   ' })).toThrow(/missing/i)
  })

  it('insists on a two-letter country code', () => {
    expect(() => validateAddress({ ...good, countryCode: 'Deutschland' })).toThrow(/two-letter/i)
    expect(() => validateAddress({ ...good, countryCode: 'de' })).toThrow(/two-letter/i)
  })

  it('rejects an unusable email, because that is where the order confirmation goes', () => {
    expect(() => validateAddress({ ...good, email: 'not-an-email' })).toThrow(/email/i)
  })
})

describe('buildOrderPayload', () => {
  const params = {
    orderReference: 'kaydo-order-abc123',
    offeringId: 4242,
    quantity: 2,
    currency: 'EUR',
    fileUrl: 'https://firebasestorage.googleapis.com/x.pdf',
    pageCount: 24,
    widthMm: 280,
    heightMm: 210,
    address: {
      name: 'Familie Muster',
      line1: 'Beispielweg 1',
      postalCode: '80331',
      city: 'München',
      countryCode: 'DE',
      email: 'familie@example.com',
    },
  }

  it('carries the reference into both the order and its item', () => {
    // The reference is the only thread back from a Peecho order to a Firestore
    // row, so it has to survive into the part Peecho echoes.
    const payload = buildOrderPayload(params)
    expect(payload.purchase_order.order_reference).toBe('kaydo-order-abc123')
    expect(payload.purchase_order.item_details[0].item_reference).toBe('kaydo-order-abc123')
  })

  it('passes the file as a URL the press fetches, with the page geometry beside it', () => {
    const file = buildOrderPayload(params).purchase_order.item_details[0].file_details
    expect(file).toEqual({
      content_url: params.fileUrl,
      pages: 24,
      width: 280,
      height: 210,
    })
  })

  it('never puts the merchant key in the payload it builds', () => {
    // The key is added by the request layer, from the environment. A builder
    // that took one would be a builder that could be called from the browser.
    expect(JSON.stringify(buildOrderPayload(params))).not.toMatch(/merchant_api_key/)
  })

  it('maps the address onto the provider’s field names', () => {
    expect(buildAddressPayload(params.address)).toMatchObject({
      name: 'Familie Muster',
      address_line_1: 'Beispielweg 1',
      postal_code: '80331',
      city: 'München',
      country_code: 'DE',
      email: 'familie@example.com',
    })
  })

  it('sends empty strings rather than undefined for the optional lines', () => {
    // undefined disappears through JSON.stringify, and a field the provider
    // expects to exist going missing is a harder error to read than an empty one.
    const mapped = buildAddressPayload(params.address)
    expect(mapped.address_line_2).toBe('')
    expect(mapped.state).toBe('')
    expect(mapped.telephone).toBe('')
  })
})

describe('requireFamilyAdmin', () => {
  const load = async (payload) => {
    vi.resetModules()
    vi.doMock('jose', () => ({
      createRemoteJWKSet: () => ({}),
      jwtVerify: async () => {
        if (!payload) throw new Error('bad signature')
        return { payload }
      },
    }))
    return import('../../api/_lib/auth.js')
  }

  const req = { headers: { authorization: 'Bearer some.jwt.token' } }

  beforeEach(() => {
    globalThis.process.env.FIREBASE_PROJECT_ID = 'demo-kaydo'
  })

  afterEach(() => {
    vi.doUnmock('jose')
    vi.resetModules()
  })

  it('accepts an admin of the family', async () => {
    const { requireFamilyAdmin } = await load({ sub: 'uid-1', familyId: 'family-1', role: 'admin' })
    await expect(requireFamilyAdmin(req, 'family-1')).resolves.toMatchObject({
      uid: 'uid-1', familyId: 'family-1', role: 'admin',
    })
  })

  it('refuses a viewer, who holds the shared password but not the chequebook', async () => {
    const { requireFamilyAdmin } = await load({ sub: 'uid-2', familyId: 'family-1', role: 'viewer' })
    await expect(requireFamilyAdmin(req, 'family-1')).rejects.toMatchObject({ code: 'not_an_admin' })
  })

  it('refuses an admin acting for a family that is not theirs', async () => {
    const { requireFamilyAdmin } = await load({ sub: 'uid-3', familyId: 'family-1', role: 'admin' })
    await expect(requireFamilyAdmin(req, 'family-2')).rejects.toMatchObject({ code: 'family_mismatch' })
  })

  it('refuses a token carrying no family claim', async () => {
    const { requireFamilyAdmin } = await load({ sub: 'uid-4', role: 'admin' })
    await expect(requireFamilyAdmin(req)).rejects.toMatchObject({ code: 'no_family' })
  })

  it('refuses a token that does not verify', async () => {
    const { requireFamilyAdmin } = await load(null)
    await expect(requireFamilyAdmin(req)).rejects.toMatchObject({ code: 'invalid_token' })
  })

  it('refuses a request with no bearer token at all', async () => {
    const { requireFamilyAdmin } = await load({ sub: 'uid-5', familyId: 'family-1', role: 'admin' })
    await expect(requireFamilyAdmin({ headers: {} })).rejects.toMatchObject({ code: 'missing_token' })
  })
})

describe('POST /api/print/order', () => {
  const BUCKET_URL = (path) =>
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=t`

  /**
   * The route with its two dependencies replaced: the signature check, and the
   * print network. Everything between them — the guards, the validation, the
   * ownership test — is the real code, which is the point.
   */
  const loadRoute = async ({ claims, createOrder = vi.fn(async () => ({ id: 'peecho-1' })) }) => {
    vi.resetModules()
    vi.doMock('jose', () => ({
      createRemoteJWKSet: () => ({}),
      jwtVerify: async () => {
        if (!claims) throw new Error('bad signature')
        return { payload: claims }
      },
    }))
    vi.doMock('../../api/_lib/printProvider.js', () => ({
      getProvider: () => ({ createOrder }),
    }))
    const mod = await import('../../api/print/order.js')
    return { handler: mod.default, createOrder }
  }

  const makeRes = () => {
    const res = { statusCode: null, body: null, headers: {} }
    res.status = (code) => { res.statusCode = code; return res }
    res.json = (payload) => { res.body = payload; return res }
    res.setHeader = (k, v) => { res.headers[k] = v }
    return res
  }

  const validBody = {
    orderReference: 'kaydo-order-abc123',
    offeringId: 4242,
    quantity: 1,
    pageCount: 24,
    widthMm: 280,
    heightMm: 210,
    currency: 'EUR',
    fileUrl: BUCKET_URL('printFiles/family-1/book-1/uuid.pdf'),
    address: {
      name: 'Familie Muster',
      line1: 'Beispielweg 1',
      postalCode: '80331',
      city: 'München',
      countryCode: 'DE',
      email: 'familie@example.com',
    },
  }

  const post = (body, headers = { authorization: 'Bearer t' }) =>
    ({ method: 'POST', headers, body })

  const adminClaims = { sub: 'uid-1', familyId: 'family-1', role: 'admin' }

  beforeEach(() => {
    globalThis.process.env.FIREBASE_PROJECT_ID = 'demo-kaydo'
    globalThis.process.env.FIREBASE_STORAGE_BUCKET = BUCKET
  })

  afterEach(() => {
    vi.doUnmock('jose')
    vi.doUnmock('../../api/_lib/printProvider.js')
    vi.resetModules()
  })

  it('places the order for a family admin', async () => {
    const { handler, createOrder } = await loadRoute({ claims: adminClaims })
    const res = makeRes()
    await handler(post(validBody), res)
    expect(res.statusCode).toBe(201)
    expect(res.body.printFilePath).toBe('printFiles/family-1/book-1/uuid.pdf')
    expect(createOrder).toHaveBeenCalledOnce()
  })

  it('never reaches the print network without a valid token', async () => {
    const { handler, createOrder } = await loadRoute({ claims: null })
    const res = makeRes()
    await handler(post(validBody), res)
    expect(res.statusCode).toBe(401)
    expect(createOrder).not.toHaveBeenCalled()
  })

  it('never reaches the print network for a viewer', async () => {
    const { handler, createOrder } = await loadRoute({
      claims: { sub: 'uid-2', familyId: 'family-1', role: 'viewer' },
    })
    const res = makeRes()
    await handler(post(validBody), res)
    expect(res.statusCode).toBe(403)
    expect(createOrder).not.toHaveBeenCalled()
  })

  it('refuses to print another family’s file even for a valid admin', async () => {
    const { handler, createOrder } = await loadRoute({ claims: adminClaims })
    const res = makeRes()
    await handler(post({ ...validBody, fileUrl: BUCKET_URL('printFiles/family-2/book-1/uuid.pdf') }), res)
    expect(res.statusCode).toBe(403)
    expect(createOrder).not.toHaveBeenCalled()
  })

  it('refuses a file URL pointing off our own storage', async () => {
    const { handler, createOrder } = await loadRoute({ claims: adminClaims })
    const res = makeRes()
    await handler(post({ ...validBody, fileUrl: 'https://attacker.example/evil.pdf' }), res)
    expect(res.statusCode).toBe(400)
    expect(createOrder).not.toHaveBeenCalled()
  })

  it('refuses a body claiming a different family than the token', async () => {
    const { handler, createOrder } = await loadRoute({ claims: adminClaims })
    const res = makeRes()
    await handler(post({ ...validBody, familyId: 'family-2' }), res)
    expect(res.statusCode).toBe(403)
    expect(createOrder).not.toHaveBeenCalled()
  })

  it('caps the quantity, so one order cannot become a pallet', async () => {
    const { handler, createOrder } = await loadRoute({ claims: adminClaims })
    const res = makeRes()
    await handler(post({ ...validBody, quantity: 5000 }), res)
    expect(res.statusCode).toBe(400)
    expect(createOrder).not.toHaveBeenCalled()
  })

  it('refuses an order reference that could collide or carry punctuation', async () => {
    const { handler } = await loadRoute({ claims: adminClaims })
    for (const bad of ['short', 'has spaces here', '../../etc/passwd']) {
      const res = makeRes()
      await handler(post({ ...validBody, orderReference: bad }), res)
      expect(res.statusCode).toBe(400)
    }
  })

  it('answers 405 to a GET rather than doing anything', async () => {
    const { handler, createOrder } = await loadRoute({ claims: adminClaims })
    const res = makeRes()
    await handler({ method: 'GET', headers: {}, body: null }, res)
    expect(res.statusCode).toBe(405)
    expect(createOrder).not.toHaveBeenCalled()
  })

  it('does not leak the provider’s own error text to the client', async () => {
    const { handler } = await loadRoute({
      claims: adminClaims,
      createOrder: vi.fn(async () => { throw new Error('merchant_api_key=SECRET rejected by upstream') }),
    })
    const res = makeRes()
    await handler(post(validBody), res)
    expect(res.statusCode).toBe(500)
    expect(JSON.stringify(res.body)).not.toMatch(/SECRET/)
  })
})
