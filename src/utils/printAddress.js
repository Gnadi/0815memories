/**
 * The delivery address: its fields, and what counts as complete.
 *
 * Kept out of the form component so the same rules can run in a test and in the
 * dialog without either importing React — and so the form fails on exactly what
 * the order endpoint would fail on, rather than on an approximation of it that
 * drifts a release later.
 */

export const ADDRESS_FIELDS = [
  { key: 'name', required: true, autoComplete: 'name', span: 2 },
  { key: 'line1', required: true, autoComplete: 'address-line1', span: 2 },
  { key: 'line2', required: false, autoComplete: 'address-line2', span: 2 },
  { key: 'postalCode', required: true, autoComplete: 'postal-code', span: 1 },
  { key: 'city', required: true, autoComplete: 'address-level2', span: 1 },
  { key: 'countryCode', required: true, autoComplete: 'country', span: 1, maxLength: 2, uppercase: true },
  { key: 'phone', required: false, autoComplete: 'tel', span: 1, type: 'tel' },
  { key: 'email', required: true, autoComplete: 'email', span: 2, type: 'email' },
]

export const EMPTY_ADDRESS = {
  name: '', line1: '', line2: '', postalCode: '', city: '', countryCode: 'DE', phone: '', email: '',
}

/**
 * The same rules `validateAddress` enforces in api/_lib/peecho.js, so the form
 * catches what the endpoint would — a red field beats a failed order.
 */
export function addressErrors(address) {
  const errors = {}
  for (const field of ADDRESS_FIELDS) {
    if (field.required && !String(address?.[field.key] || '').trim()) errors[field.key] = 'required'
  }
  if (address?.countryCode && !/^[A-Z]{2}$/.test(address.countryCode)) errors.countryCode = 'country'
  if (address?.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address.email)) errors.email = 'email'
  return errors
}
