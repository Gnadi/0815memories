/**
 * Place a print order.
 *
 * The one endpoint here that spends money and ships a physical object to a real
 * address, so it is the one worth being unfriendly about:
 *
 *  - the caller must be an admin of a family (checked against Google's public
 *    keys, not against anything the request says about itself);
 *  - the print file must live in our own bucket, under *that* family's folder,
 *    so a URL pasted from elsewhere cannot be printed and another family's book
 *    cannot be ordered by anyone who learns its link;
 *  - the family is taken from the verified token throughout — the body's own
 *    idea of who it is only ever gets to disagree, never to decide.
 *
 * What it deliberately does not do is delete the print file. The press has not
 * fetched it yet; cleanup belongs to fulfilment, once the order is in a state
 * where the file is no longer needed.
 */

import { requireFamilyAdmin } from '../_lib/auth.js'
import { badRequest, methodGuard, readJsonBody, withErrorHandling } from '../_lib/http.js'
import { assertOwnPrintFile } from '../_lib/printFileUrl.js'
import { getProvider } from '../_lib/printProvider.js'

const MAX_QUANTITY = 20

export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ['POST'])) return

  const body = readJsonBody(req)
  const identity = await requireFamilyAdmin(req, body.familyId)

  const orderReference = String(body.orderReference || '').trim()
  const offeringId = body.offeringId
  const quantity = Number(body.quantity ?? 1)
  const pageCount = Number(body.pageCount)
  const widthMm = Number(body.widthMm)
  const heightMm = Number(body.heightMm)
  const currency = String(body.currency || 'EUR').toUpperCase()

  // The reference is how a Peecho order is found again from a Firestore row, so
  // the client has to supply a stable one — and it has to be its own, not a
  // string that could collide with another family's order.
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(orderReference)) {
    throw badRequest('invalid_reference', 'Order reference must be 8-64 characters of A-Z, a-z, 0-9, - or _')
  }
  if (!offeringId) throw badRequest('missing_offering', 'No product chosen')
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw badRequest('invalid_quantity', `Quantity must be between 1 and ${MAX_QUANTITY}`)
  }
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw badRequest('invalid_page_count', 'Page count must be a positive whole number')
  }
  if (!(widthMm > 0) || !(heightMm > 0)) {
    throw badRequest('invalid_dimensions', 'Page dimensions are missing')
  }

  // Throws unless the URL is ours, this family's, and a print file.
  const file = assertOwnPrintFile(body.fileUrl, identity.familyId)

  const order = await getProvider().createOrder({
    orderReference,
    offeringId,
    quantity,
    currency,
    fileUrl: body.fileUrl,
    pageCount,
    widthMm,
    heightMm,
    address: body.address,
  })

  res.status(201).json({
    order,
    orderReference,
    // Handed back so fulfilment knows which object to delete later, without
    // having to re-derive it from a URL.
    printFilePath: file.path,
  })
})
