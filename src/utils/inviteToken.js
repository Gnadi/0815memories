// Generates a 32-byte URL-safe random token used as the doc ID for invites.
// Possessing the token is the credential for redemption — same security model
// as a "share link" — so we use crypto.getRandomValues, not Math.random.
export function generateInviteToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

// The token rides in the fragment, after `#`. A browser never sends the
// fragment anywhere: not to the server or the CDN's request logs, and not in a
// Referer header. In the query, where it used to be, a working admin invite
// was in every log that keeps full request URLs.
export function buildInviteUrl(familyId, token) {
  return `${window.location.origin}/invite?family=${encodeURIComponent(familyId)}#token=${encodeURIComponent(token)}`
}

/**
 * The token of an invite link: from the fragment, or from the query of a link
 * made before it moved there, which still works.
 *
 * @param {URLSearchParams} searchParams
 * @param {string} hash  `location.hash`, with or without its `#`
 * @returns {{ token: string|null, fromQuery: boolean }}
 */
export function readInviteToken(searchParams, hash) {
  const fromHash = new URLSearchParams(String(hash ?? '').replace(/^#/, '')).get('token')
  if (fromHash) return { token: fromHash, fromQuery: false }
  const fromQuery = searchParams.get('token')
  return { token: fromQuery || null, fromQuery: Boolean(fromQuery) }
}
