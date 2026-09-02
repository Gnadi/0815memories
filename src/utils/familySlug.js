import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../config/firebase'

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

/**
 * Look up a family by its slug.
 *
 * Reads `familyPublic`, not `families`. The two carry the same slug, but only
 * `familyPublic` is world-readable — and it is written by a Cloud Function from
 * a fixed allowlist, so it cannot carry the encryption key or the password hash
 * however the private document grows. Callers here are unauthenticated by
 * definition: this is the login page and the signup form.
 *
 * Returns { id, ...publicFields } or null.
 */
export async function resolveFamilyBySlug(slug) {
  if (!db || !slug) return null

  const q = query(collection(db, 'familyPublic'), where('familySlug', '==', slug))
  const snapshot = await getDocs(q)

  if (snapshot.empty) return null

  const doc = snapshot.docs[0]
  return { id: doc.id, ...doc.data() }
}

/**
 * Check if a slug is available (not already taken by another family).
 *
 * Runs during signup, before the account exists, so it has to work without a
 * token — hence `familyPublic` again.
 */
export async function isSlugAvailable(slug, excludeFamilyId = null) {
  if (!db || !slug) return false

  const q = query(collection(db, 'familyPublic'), where('familySlug', '==', slug))
  const snapshot = await getDocs(q)

  if (snapshot.empty) return true

  // If we're excluding a specific family (for edits), check if the match is that family
  if (excludeFamilyId) {
    return snapshot.docs.every((doc) => doc.id === excludeFamilyId)
  }

  return false
}
