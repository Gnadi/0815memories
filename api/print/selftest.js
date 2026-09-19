/**
 * Ask the print network what it actually accepts.
 *
 * The Peecho payload shapes in `_lib/peecho.js` are assembled from secondary
 * sources — Peecho's own reference was not reachable when they were written —
 * so they are a reading, not a spec. This endpoint calls each one with a real
 * merchant key and reports what came back, including Peecho's own error text,
 * which settles in one request what no amount of further guessing would.
 *
 * Admin-only despite being read-only: it proves whether a merchant key is
 * configured and which environment it points at, and neither is public
 * information.
 */

import { timingSafeEqual } from 'node:crypto'
import { requireFamilyAdmin } from '../_lib/auth.js'
import { methodGuard, withErrorHandling } from '../_lib/http.js'
import { getProvider } from '../_lib/printProvider.js'

/**
 * A way in without a browser session, for the one job this route exists for:
 * curling the print network before any UI is wired up.
 *
 * Scoped as tightly as it can be and still be useful. It only works when
 * PRINT_SELFTEST_SECRET is set — absent, which is the default, this route is
 * admin-only like the rest — it never applies to quote, order or status, and it
 * is meant to be removed from the environment once the check has been run. What
 * it can reveal is which Peecho environment is configured and what Peecho says
 * back; it cannot place an order or read the merchant key.
 */
function hasSelftestSecret(req) {
  const expected = process.env.PRINT_SELFTEST_SECRET
  if (!expected) return false
  const given = String(req.headers?.['x-print-selftest'] || '')
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // length, so the lengths are compared into the same boolean.
  return a.length === b.length && timingSafeEqual(a, b)
}

export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ['GET'])) return
  if (!hasSelftestSecret(req)) await requireFamilyAdmin(req)

  const provider = getProvider()
  res.status(200).json({
    config: provider.describeConfig(),
    probes: await provider.selfTest(),
  })
})
