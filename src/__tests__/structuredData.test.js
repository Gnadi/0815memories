import { describe, it, expect } from 'vitest'
import { landingStructuredData, breadcrumbStructuredData, SAME_AS } from '../utils/structuredData'

const graph = landingStructuredData({
  lang: 'de',
  description: 'Beschreibung',
  features: ['Eins'],
  screenshots: ['https://kaydo.app/screenshots/de/home-desktop.webp'],
})
const node = (type) => graph['@graph'].find((n) => n['@type'] === type)

describe('landing page structured data', () => {
  it('describes the website, the organisation and the app, each named Kaydo', () => {
    expect(graph['@graph'].map((n) => n['@type'])).toEqual(['WebSite', 'Organization', 'WebApplication'])
    for (const n of graph['@graph']) expect(n.name).toBe('Kaydo')
    expect(node('WebSite').alternateName).toEqual(['Kaydo App', 'kaydo.app'])
  })

  it('ties them together by @id', () => {
    const org = node('Organization')['@id']
    expect(node('WebSite').publisher).toEqual({ '@id': org })
    expect(node('WebApplication').publisher).toEqual({ '@id': org })
  })

  it('gives the organisation an absolute logo and its other addresses', () => {
    expect(node('Organization').logo).toBe('https://kaydo.app/icons/pwa-512x512.png')
    expect(node('Organization').sameAs).toEqual(SAME_AS)
  })

  it('states the page language and a free offer without a currency the page does not name', () => {
    expect(node('WebSite').inLanguage).toBe('de')
    expect(node('WebApplication').inLanguage).toBe('de')
    expect(node('WebApplication').offers).toEqual({ '@type': 'Offer', price: '0' })
    expect(node('WebApplication').applicationCategory).toBe('LifestyleApplication')
  })

  it('claims no rating, reviews or FAQ', () => {
    const json = JSON.stringify(graph)
    expect(json).not.toMatch(/aggregateRating|"review|FAQPage/)
  })

  it('survives a round trip through JSON', () => {
    expect(JSON.parse(JSON.stringify(graph))).toEqual(graph)
  })
})

describe('breadcrumb', () => {
  it('leads from the landing page to the page, with absolute addresses', () => {
    const crumbs = breadcrumbStructuredData({ home: 'Start', homePath: '/de', name: 'Fotobuch', path: '/de/familien-fotobuch' })
    expect(crumbs['@type']).toBe('BreadcrumbList')
    expect(crumbs.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Start', item: 'https://kaydo.app/de' },
      { '@type': 'ListItem', position: 2, name: 'Fotobuch', item: 'https://kaydo.app/de/familien-fotobuch' },
    ])
  })
})
