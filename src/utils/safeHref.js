// Link hrefs are user input. React does not reliably block `javascript:`, so
// this allowlist is the one deliberate sanitization point in the read path.
const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:']

export function safeHref(href) {
  if (typeof href !== 'string' || !href) return null
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://kaydo.app'
    return SAFE_PROTOCOLS.includes(new URL(href, base).protocol) ? href : null
  } catch {
    return null
  }
}
