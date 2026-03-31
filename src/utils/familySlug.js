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
 * Look up a family document by its slug.
 * Returns { id, ...data } or null.
 */
export async function resolveFamilyBySlug(slug) {
  if (!db || !slug) return null

  const q = query(collection(db, 'families'), where('familySlug', '==', slug))
  const snapshot = await getDocs(q)

  if (snapshot.empty) return null

  const doc = snapshot.docs[0]
  return { id: doc.id, ...doc.data() }
}

/**
 * Check if a slug is available (not already taken by another family).
 */
export async function isSlugAvailable(slug, excludeFamilyId = null) {
  if (!db || !slug) return false

  const q = query(collection(db, 'families'), where('familySlug', '==', slug))
  const snapshot = await getDocs(q)

  if (snapshot.empty) return true

  // If we're excluding a specific family (for edits), check if the match is that family
  if (excludeFamilyId) {
    return snapshot.docs.every((doc) => doc.id === excludeFamilyId)
  }

  return false
}
