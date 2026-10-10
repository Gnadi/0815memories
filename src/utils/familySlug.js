/**
 * Generate a URL-safe slug from a family name.
 * "The Millers" → "the-millers"
 */
export function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Extract a family slug from the current hostname's subdomain.
 * Returns null on localhost, IPs, bare domains, or vercel.app preview URLs.
 * E.g. "the-millers.familyheart.com" → "the-millers"
 */
export function getSubdomainSlug() {
  // No subdomain context during server-side pre-rendering (vite-react-ssg).
  if (typeof window === 'undefined') return null

  const hostname = window.location.hostname

  // Skip localhost and IP addresses
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null
  }

  const parts = hostname.split('.')

  // Need at least 3 parts: slug.domain.tld
  // Skip *.vercel.app since wildcard subdomains aren't supported there
  if (parts.length < 3) return null
  if (parts.slice(-2).join('.') === 'vercel.app') return null

  // The subdomain is everything before the last two parts (domain.tld)
  const subdomain = parts.slice(0, -2).join('.')

  // Skip www or empty subdomains
  if (!subdomain || subdomain === 'www') return null

  return subdomain
}
