/**
 * The public addresses search engines should know, in one list for the pages,
 * the router, the pre-render, vercel.json's rewrites and the sitemap
 * (scripts/sitemap.mjs, which Node runs after the build). It stays plain
 * JavaScript with no imports for that reason.
 *
 * Every page lives on https://kaydo.app. A family's subdomain is never one of
 * them: vercel.json and index.html keep those out of search results.
 */
export const SITE_ORIGIN = 'https://kaydo.app'

/**
 * The feature pages: one per thing people search for before they know Kaydo,
 * each in English and German at an address of its own. `screenshot` is the
 * key of the picture it shows (src/components/landing/screenshots.js) and
 * `frame` the device it is shown in.
 */
export const FEATURE_PAGES = [
  {
    id: 'photoSharing',
    paths: { en: '/private-family-photo-sharing', de: '/de/familienfotos-privat-teilen' },
    screenshot: 'homeMobile',
    frame: 'phone',
  },
  {
    id: 'timeCapsule',
    paths: { en: '/family-time-capsule', de: '/de/zeitkapsel-fuer-kinder' },
    screenshot: 'blackbox',
    frame: 'browser',
  },
  {
    id: 'recipeBook',
    paths: { en: '/family-recipe-book', de: '/de/familien-rezeptbuch' },
    screenshot: 'recipeTree',
    frame: 'browser',
  },
  {
    id: 'photoBook',
    paths: { en: '/family-scrapbook-photo-book', de: '/de/familien-fotobuch' },
    screenshot: 'scrapbook',
    frame: 'browser',
  },
]

// The landing page's addresses. src/i18n re-exports them as LANDING_PATHS.
export const LANDING_PAGE_PATHS = { en: '/', de: '/de', ar: '/ar' }

// The legal pages exist at one address each, in the visitor's language.
export const SINGLE_LANGUAGE_PATHS = ['/terms', '/privacy-policy', '/contact', '/safety']

// Pages that exist in both languages, as { en, de } path pairs.
export const LANGUAGE_GROUPS = [LANDING_PAGE_PATHS, ...FEATURE_PAGES.map((page) => page.paths)]

/** Every address that belongs in the index, in sitemap order. */
export const INDEXABLE_PATHS = [
  ...LANGUAGE_GROUPS.flatMap((group) => Object.values(group)),
  ...SINGLE_LANGUAGE_PATHS,
]

export const absoluteUrl = (path) => `${SITE_ORIGIN}${path}`

/**
 * The hreflang alternates of a page as [hreflang, absolute URL] pairs: each
 * language, then x-default on the English page. A page in one language only
 * has none.
 */
export function alternatesFor(path) {
  const group = LANGUAGE_GROUPS.find((paths) => Object.values(paths).includes(path))
  if (!group) return []
  return [
    ...Object.entries(group).map(([lng, p]) => [lng, absoluteUrl(p)]),
    ['x-default', absoluteUrl(group.en)],
  ]
}

/**
 * The language an address fixes, or undefined. "/" names none: it is English
 * to crawlers and the visitor's language to everyone else.
 */
export function pathLanguage(pathname) {
  for (const group of LANGUAGE_GROUPS) {
    const lng = Object.keys(group).find((key) => group[key] === pathname)
    if (lng && pathname !== '/') return lng
  }
  return undefined
}
