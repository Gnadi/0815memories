/**
 * Where an order got to.
 *
 * Admin-only and family-scoped like the rest, but the scoping here cannot come
 * from the print network: Peecho knows an order reference, not which Kaydo
 * family it belongs to. So the reference itself has to be unguessable and the
 * caller has to be an admin — and once orders are recorded in Firestore
 * (Phase 5), this should additionally check the reference against that family's
 * own rows rather than trusting whatever reference was passed in.
 */

import { requireFamilyAdmin } from '../_lib/auth.js'
import { badRequest, methodGuard, withErrorHandling } from '../_lib/http.js'
import { getProvider } from '../_lib/printProvider.js'

export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ['GET'])) return
  await requireFamilyAdmin(req)

  const orderReference = String(req.query?.orderReference || '').trim()
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(orderReference)) {
    throw badRequest('invalid_reference', 'Order reference is missing or malformed')
  }

  const status = await getProvider().getOrderStatus(orderReference)
  res.status(200).json({ status })
})
