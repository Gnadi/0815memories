// The shortest admin password Kaydo sets: at signup, through an invite and when
// it is changed. Signing in still takes a shorter one set before this was 8.
//
// The page behind a reset email belongs to Firebase and checks only Firebase's
// own minimum; the project's password policy is what holds it to this one.
// The family password for guests has its own minimum, in functions/index.js.
export const MIN_PASSWORD_LENGTH = 8
