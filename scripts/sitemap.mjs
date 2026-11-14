/**
 * The sitemap, built from src/seoRoutes.js so it lists exactly the pages that
 * are pre-rendered and indexable, each with its language alternates. It used
 * to be a file in public/ kept in step with the pages by hand.
 *
 * No <lastmod>, <changefreq> or <priority>: Google ignores the last two, and a
 * lastmod that changes with every build, whether the page did or not, teaches
 * it to ignore the first.
 */
import { INDEXABLE_PATHS, absoluteUrl, alternatesFor } from '../src/seoRoutes.js'

export function buildSitemap() {
  const urls = INDEXABLE_PATHS.map((path) => {
    const links = alternatesFor(path).map(
      ([lng, href]) => `    <xhtml:link rel="alternate" hreflang="${lng}" href="${href}"/>`,
    )
    return ['  <url>', `    <loc>${absoluteUrl(path)}</loc>`, ...links, '  </url>'].join('\n')
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}
