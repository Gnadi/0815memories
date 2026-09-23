/**
 * What a book would cost, before anybody commits to it.
 *
 * Quoting is a separate call from ordering on purpose. The price depends on the
 * page count and the destination country, both of which the user can still
 * change, and finding out what a book costs should never risk accidentally
 * having one printed.
 */

import { requireFamilyAdmin } from '../_lib/auth.js'
import { badRequest, methodGuard, readJsonBody, withErrorHandling } from '../_lib/http.js'
import { getProvider } from '../_lib/printProvider.js'

const MAX_QUANTITY = 20

export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ['POST'])) return
  await requireFamilyAdmin(req)

  const body = readJsonBody(req)
  const offeringId = body.offeringId
  const quantity = Number(body.quantity ?? 1)
  const pageCount = Number(body.pageCount)
  const countryCode = String(body.countryCode || '').toUpperCase()
  const currency = String(body.currency || 'EUR').toUpperCase()

  if (!offeringId) throw badRequest('missing_offering', 'No product chosen')
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw badRequest('invalid_quantity', `Quantity must be between 1 and ${MAX_QUANTITY}`)
  }
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw badRequest('invalid_page_count', 'Page count must be a positive whole number')
  }
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    throw badRequest('invalid_country', 'Country must be a two-letter ISO code')
  }

  const price = await getProvider().calculatePrice({ offeringId, quantity, pageCount, countryCode, currency })
  res.status(200).json({ price })
})
