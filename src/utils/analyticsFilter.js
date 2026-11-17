import { INDEXABLE_PATHS } from '../seoRoutes'
import { getSubdomainSlug } from './familySlug'

// Vercel Analytics and Speed Insights report the address of every page they
// see. Inside the signed-in app and on a family's own subdomain that address
// can carry a family, a memory or an invite, so only the public pages — the
// landing page, the feature pages and the legal pages, i.e. the pre-rendered
// routes — are ever reported. Both libraries call this as `beforeSend`: the
// event it returns is sent, `null` cancels it.
const REPORTED_PATHS = new Set(INDEXABLE_PATHS)

function normalizePath(pathname) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
}

export function filterAnalyticsEvent(event, { subdomainSlug = getSubdomainSlug() } = {}) {
  // A family's subdomain is its private address: nothing is sent from there.
  if (subdomainSlug) return null
  // The app records no custom events; anything else would carry data we have
  // not looked at.
  if (!event || event.type === 'event') return null
  let url
  try {
    url = new URL(event.url)
  } catch {
    return null
  }
  const path = normalizePath(url.pathname)
  if (!REPORTED_PATHS.has(path)) return null
  // Query and hash are dropped: they can hold an invite token or a family id.
  const clean = { ...event, url: url.origin + path }
  // Speed Insights also reports the route pattern; for these pages it is the path.
  if ('route' in clean) clean.route = path
  return clean
}
