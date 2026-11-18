import { describe, it, expect } from 'vitest'
import { filterAnalyticsEvent } from '../utils/analyticsFilter'
import { INDEXABLE_PATHS } from '../seoRoutes'

const view = (url, extra = {}) => ({ type: 'pageview', url, ...extra })
const none = { subdomainSlug: null }

describe('filterAnalyticsEvent', () => {
  it('lets every public pre-rendered page through', () => {
    expect(INDEXABLE_PATHS).toContain('/')
    expect(INDEXABLE_PATHS).toContain('/de')
    for (const path of INDEXABLE_PATHS) {
      const url = `https://kaydo.app${path}`
      expect(filterAnalyticsEvent(view(url), none)).toEqual(view(url))
    }
  })

  it('drops query and hash', () => {
    expect(filterAnalyticsEvent(view('https://kaydo.app/terms?invite=abc#x'), none))
      .toEqual(view('https://kaydo.app/terms'))
    expect(filterAnalyticsEvent(view('https://kaydo.app/?family=f1'), none))
      .toEqual(view('https://kaydo.app/'))
  })

  it('treats a trailing slash like the page itself', () => {
    expect(filterAnalyticsEvent(view('https://kaydo.app/de/'), none).url).toBe('https://kaydo.app/de')
  })

  it('cancels the signed-in app, login, signup and invite routes', () => {
    for (const path of ['/home', '/memory/abc', '/login', '/family/the-millers', '/signup', '/invite', '/settings', '/demo', '/unknown']) {
      expect(filterAnalyticsEvent(view(`https://kaydo.app${path}`), none)).toBeNull()
    }
  })

  it('sends nothing from a family subdomain, even on a public path', () => {
    expect(filterAnalyticsEvent(view('https://the-millers.kaydo.app/'), { subdomainSlug: 'the-millers' })).toBeNull()
  })

  it('cancels custom events and malformed ones', () => {
    expect(filterAnalyticsEvent({ type: 'event', url: 'https://kaydo.app/' }, none)).toBeNull()
    expect(filterAnalyticsEvent(view('not a url'), none)).toBeNull()
    expect(filterAnalyticsEvent(null, none)).toBeNull()
  })

  it('cleans the route of a Speed Insights event', () => {
    expect(filterAnalyticsEvent({ type: 'vital', url: 'https://kaydo.app/safety?x=1', route: '/safety?x=1' }, none))
      .toEqual({ type: 'vital', url: 'https://kaydo.app/safety', route: '/safety' })
  })

  it('reads the host from the page by default', () => {
    // jsdom runs on localhost, which has no family subdomain.
    expect(filterAnalyticsEvent(view('https://kaydo.app/contact'))).not.toBeNull()
  })
})
