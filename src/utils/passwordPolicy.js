// Shortest password accepted when an admin account is created (sign-up, invite,
// claim on the landing page). Length is the one rule that matters for an
// account guarding a family's archive; Firebase's own floor is only 6.
// Signing in is deliberately not checked against it: existing passwords stay valid.
export const MIN_PASSWORD_LENGTH = 12

// The family's shared password is hashed with bcrypt, which reads at most 72
// bytes and silently ignores the rest: a change past that point would leave
// the old password working. Mirrors MAX_SHARED_PASSWORD_BYTES in
// functions/viewerLogin.js, which refuses it too.
export const MAX_SHARED_PASSWORD_BYTES = 72

export function sharedPasswordTooLong(password) {
  return new TextEncoder().encode(String(password ?? '')).length > MAX_SHARED_PASSWORD_BYTES
}
