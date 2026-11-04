/**
 * What a family's shared password may be — checked by setSharedPassword in
 * index.js, and mirrored by SettingsPanel so the form can say so first.
 *
 * It is what stands between a guesser and the family's encryption key, and
 * guessing is throttled, not stopped: hence a minimum. And bcrypt reads only
 * the first 72 bytes of what it hashes, so a password changed only past them
 * was no change at all — the old one kept signing in. Hence a maximum, in
 * UTF-8 bytes rather than characters, since an umlaut or an emoji takes two to
 * four. Existing passwords keep working either way; this only decides what may
 * be set.
 */
export const MIN_SHARED_PASSWORD_LENGTH = 8
export const MAX_SHARED_PASSWORD_BYTES = 72

/** 'too-short', 'too-long', or null for a password that may be set. */
export function sharedPasswordProblem(password) {
  if (typeof password !== 'string' || password.length < MIN_SHARED_PASSWORD_LENGTH) return 'too-short'
  if (new TextEncoder().encode(password).length > MAX_SHARED_PASSWORD_BYTES) return 'too-long'
  return null
}
