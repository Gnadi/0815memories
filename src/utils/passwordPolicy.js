// Shortest password accepted when an admin account is created (sign-up, invite,
// claim on the landing page). Length is the one rule that matters for an
// account guarding a family's archive; Firebase's own floor is only 6.
// Signing in is deliberately not checked against it: existing passwords stay valid.
export const MIN_PASSWORD_LENGTH = 12
