/**
 * The print network's catalogue.
 *
 * This is also how the open question from the provider analysis gets answered:
 * which 4:3 format Peecho actually carries, and what page limits it really
 * imposes. Until this has been run against a live key, `printFormats.js` holds
 * conservative stand-ins that are stricter than any press, never looser.
 */

import { requireFamilyAdmin } from '../_lib/auth.js'
import { methodGuard, withErrorHandling } from '../_lib/http.js'
import { getProvider } from '../_lib/printProvider.js'

export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ['GET'])) return
  await requireFamilyAdmin(req)

  const offerings = await getProvider().listOfferings()
  res.status(200).json({ offerings })
})
