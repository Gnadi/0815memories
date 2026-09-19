/**
 * The print network, behind one name.
 *
 * Routes import from here and never from a provider directly, so the day
 * Prodigi replaces Peecho — a real possibility, they own it — the change is a
 * new sibling of `peecho.js` and one line in this file, not a rewrite of every
 * endpoint.
 *
 * The vocabulary the routes get is deliberately small and provider-neutral:
 * list what can be printed, price one order, place it, ask where it got to.
 * Anything that reads as Peecho's own wording belongs on the other side of
 * this boundary.
 */

import * as peecho from './peecho.js'

const PROVIDERS = { peecho }

export function getProvider() {
  const name = process.env.PRINT_PROVIDER || 'peecho'
  const provider = PROVIDERS[name]
  if (!provider) {
    throw new Error(`Unknown PRINT_PROVIDER "${name}" — known: ${Object.keys(PROVIDERS).join(', ')}`)
  }
  return provider
}
