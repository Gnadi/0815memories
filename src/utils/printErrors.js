/**
 * The vocabulary of print failures, in one place.
 *
 * Ordering can fail in a dozen ways and they are not equivalent: some are the
 * user's to fix (an incomplete address), some are ours (a missing key), and
 * some are nobody's and will pass (the print network is down). Collapsing them
 * into "something went wrong" is what turns a two-minute fix into a support
 * conversation, so each carries a code the UI translates into a sentence that
 * says what to do next.
 */

export class ApiRequestError extends Error {
  constructor(code, message, status) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
    this.status = status
  }
}

/** Codes the endpoints return, mapped to the i18n key that explains them. */
const MESSAGE_KEYS = {
  not_signed_in: 'print.errors.notSignedIn',
  missing_token: 'print.errors.notSignedIn',
  invalid_token: 'print.errors.sessionExpired',
  not_an_admin: 'print.errors.adminOnly',
  no_family: 'print.errors.adminOnly',
  family_mismatch: 'print.errors.adminOnly',
  incomplete_address: 'print.errors.incompleteAddress',
  invalid_country: 'print.errors.invalidCountry',
  invalid_email: 'print.errors.invalidEmail',
  foreign_file_url: 'print.errors.fileNotOurs',
  foreign_family_file: 'print.errors.fileNotOurs',
  not_a_print_file: 'print.errors.fileNotOurs',
  missing_file_url: 'print.errors.fileMissing',
  provider_timeout: 'print.errors.providerSlow',
  provider_unreachable: 'print.errors.providerDown',
  provider_rejected: 'print.errors.providerRejected',
  provider_error: 'print.errors.providerRejected',
  misconfigured: 'print.errors.misconfigured',
}

export function printErrorKey(error) {
  return MESSAGE_KEYS[error?.code] || 'print.errors.generic'
}

/**
 * Whether trying the same thing again could plausibly work.
 *
 * Drives whether the UI offers a retry button. Offering one for an incomplete
 * address is worse than not offering one at all: it invites the user to press
 * it repeatedly against a wall.
 */
export function isRetryable(error) {
  return ['provider_timeout', 'provider_unreachable', 'internal_error'].includes(error?.code)
    || (error?.status >= 500 && error?.code !== 'misconfigured')
}
