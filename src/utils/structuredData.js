/**
 * JSON-LD for the public pages.
 *
 * "Kaydo" is close to other names (Kaydoh, Keydo, Kayo), and searches for it
 * found the site at about position five. The landing page therefore says in
 * one connected graph that Kaydo is this website, made by this organisation,
 * and is this free web app, with the same @id everywhere so the three are read
 * as one thing.
 *
 * It claims nothing the page does not show: no rating, no reviews, and no
 * FAQPage, which Google no longer shows for a site like this one. The offer
 * has no currency because the page names none, only that Kaydo is free.
 */
import { SITE_ORIGIN, absoluteUrl } from '../seoRoutes'

const WEBSITE_ID = `${SITE_ORIGIN}/#website`
const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`
const APP_ID = `${SITE_ORIGIN}/#app`

export const SAME_AS = [
  'https://github.com/Gnadi/0815memories',
  'https://blog.gnadlinger.me/blog/kaydo/',
]

/**
 * The landing page's graph. `lang` is the page's language; `description`,
 * `features` and `screenshots` (absolute URLs) are what the page itself says
 * and shows in it.
 */
export function landingStructuredData({ lang, description, features, screenshots }) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        name: 'Kaydo',
        alternateName: ['Kaydo App', 'kaydo.app'],
        url: `${SITE_ORIGIN}/`,
        inLanguage: lang,
        publisher: { '@id': ORGANIZATION_ID },
      },
      {
        '@type': 'Organization',
        '@id': ORGANIZATION_ID,
        name: 'Kaydo',
        url: `${SITE_ORIGIN}/`,
        // Square and larger than the 112 × 112 px Google asks for.
        logo: absoluteUrl('/icons/pwa-512x512.png'),
        sameAs: SAME_AS,
      },
      {
        '@type': 'WebApplication',
        '@id': APP_ID,
        name: 'Kaydo',
        url: `${SITE_ORIGIN}/`,
        description,
        applicationCategory: 'LifestyleApplication',
        operatingSystem: 'Web',
        inLanguage: lang,
        offers: { '@type': 'Offer', price: '0' },
        featureList: features,
        screenshot: screenshots,
        publisher: { '@id': ORGANIZATION_ID },
      },
    ],
  }
}

/**
 * The breadcrumb of a page one step below the landing page: `home` and `name`
 * are the two steps' names, `homePath` and `path` their addresses.
 */
export function breadcrumbStructuredData({ home, homePath, name, path }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: home, item: absoluteUrl(homePath) },
      { '@type': 'ListItem', position: 2, name, item: absoluteUrl(path) },
    ],
  }
}
