// Where to go after signing in, carried through the login page as ?next=.
//
// Only a path on this site is accepted. Anything else — another origin,
// "//evil.example" (protocol-relative), "/\evil.example" (which browsers read
// the same way) — would let a crafted link send someone who just signed in
// to a page that only looks like Kaydo.
export function safeNextPath(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return null
  if (raw.startsWith('//') || raw.includes('\\')) return null
  // Control characters (a tab or newline inside "//") are dropped by URL
  // parsers, which would turn "/\t/evil.example" into "//evil.example".
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null
  // Back to the login or signup page would be a loop.
  if (/^\/(login|signup)(\/|\?|$)/.test(raw)) return null
  return raw
}

// The login address that comes back to `location` afterwards.
export function loginPathFor({ pathname, search = '' }) {
  return `/login?next=${encodeURIComponent(pathname + search)}`
}
