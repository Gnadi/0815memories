import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('workbox-core', () => ({ clientsClaim: vi.fn() }))
vi.mock('workbox-precaching', () => ({ precacheAndRoute: vi.fn() }))
vi.mock('workbox-routing', () => ({ registerRoute: vi.fn() }))
vi.mock('workbox-strategies', () => ({ CacheFirst: class {}, NetworkOnly: class {} }))
vi.mock('workbox-expiration', () => ({ ExpirationPlugin: class {} }))
vi.mock('workbox-cacheable-response', () => ({ CacheableResponsePlugin: class {} }))

const ORIGIN = 'https://kaydo.app'

describe('service worker notificationclick', () => {
  let click
  let openWindow

  beforeEach(async () => {
    const listeners = {}
    openWindow = vi.fn()
    vi.stubGlobal('self', {
      __WB_MANIFEST: [],
      location: { origin: ORIGIN },
      skipWaiting: vi.fn(),
      addEventListener: (type, fn) => { listeners[type] = fn },
    })
    vi.stubGlobal('clients', { matchAll: () => Promise.resolve([]), openWindow })
    vi.resetModules()
    await import('../sw.js')
    click = async (url) => {
      let pending
      await listeners.notificationclick({
        notification: { close: vi.fn(), data: url === undefined ? undefined : { url } },
        waitUntil: (p) => { pending = p },
      })
      await pending
      return openWindow.mock.calls[0]?.[0]
    }
  })

  it('opens same-origin targets', async () => {
    expect(await click('/memory/abc')).toBe(`${ORIGIN}/memory/abc`)
  })

  it('accepts absolute URLs on its own origin', async () => {
    expect(await click(`${ORIGIN}/home?x=1`)).toBe(`${ORIGIN}/home?x=1`)
  })

  it('falls back to the root for foreign or unusable targets', async () => {
    for (const url of ['https://evil.example/login', '//evil.example/x', 'javascript:alert(1)', 'data:text/html,hi', 42, {}]) {
      openWindow.mockClear()
      expect(await click(url)).toBe('/')
    }
  })

  it('opens the root when the payload carries no url', async () => {
    expect(await click(undefined)).toBe('/')
  })
})
