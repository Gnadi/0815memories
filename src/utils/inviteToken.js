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

export function buildInviteUrl(familyId, token) {
  return `${window.location.origin}/invite?family=${encodeURIComponent(familyId)}&token=${encodeURIComponent(token)}`
}
