/**
 * Stand-ins for encryptText() output in the rules tests.
 *
 * firestore.rules accepts only what encryptText() could have written in an
 * encrypted field (isCiphertext): base64, a multiple of four, and at least the
 * 40 characters of an IV and a tag. These are that shape, and tell apart by
 * their label which write a test means — they decrypt to nothing.
 */
export const sealed = (label = '') => btoa(`kaydo-test-ciphertext/${label}`.padEnd(30, '.'))

export const CIPHERTEXT = sealed()
