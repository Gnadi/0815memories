// Paths built to their own static HTML at build time (vite-react-ssg). Every
// other path is client-rendered and served the "/" HTML as the SPA fallback —
// see the rewrites in vercel.json, which must list each of these.
//
// Only pages whose first render depends on nothing but the URL belong here: the
// pre-rendered markup has to match what the browser renders on hydration. The
// legal pages qualify; /login does not (its first render reads the family
// subdomain and a localStorage cache).
export const PRERENDERED_PATHS = ['/', '/terms', '/privacy-policy', '/contact', '/safety']
