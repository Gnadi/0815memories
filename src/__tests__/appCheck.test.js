/* App Check is the client half of what ENFORCE_APP_CHECK on the functions
   asks for. Off without a site key; with one, set up once, before the first
   call, and never in the way when it cannot be. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const getApp = vi.fn()
vi.mock('firebase/app', () => ({ getApp: (...a) => getApp(...a) }))
const initializeAppCheck = vi.fn(() => ({ appCheck: true }))
vi.mock('firebase/app-check', () => ({
  initializeAppCheck: (...a) => initializeAppCheck(...a),
  ReCaptchaEnterpriseProvider: class { constructor(key) { this.key = key } },
}))

const load = async () => (await import('../config/appCheck')).appCheckReady

beforeEach(() => {
  vi.resetModules()
  getApp.mockReset().mockReturnValue({ name: 'app' })
  initializeAppCheck.mockClear()
})
afterEach(() => vi.unstubAllEnvs())

describe('appCheckReady', () => {
  it('does nothing without a site key', async () => {
    vi.stubEnv('VITE_APPCHECK_SITE_KEY', '')
    expect(await (await load())()).toBeNull()
    expect(initializeAppCheck).not.toHaveBeenCalled()
  })

  it('sets App Check up once with the site key, however often it is awaited', async () => {
    vi.stubEnv('VITE_APPCHECK_SITE_KEY', 'site-key')
    const appCheckReady = await load()
    await Promise.all([appCheckReady(), appCheckReady()])
    expect(initializeAppCheck).toHaveBeenCalledTimes(1)
    const [app, options] = initializeAppCheck.mock.calls[0]
    expect(app).toEqual({ name: 'app' })
    expect(options).toMatchObject({ provider: { key: 'site-key' }, isTokenAutoRefreshEnabled: true })
  })

  it('lets the call go on when Firebase is not set up, or App Check fails', async () => {
    vi.stubEnv('VITE_APPCHECK_SITE_KEY', 'site-key')
    getApp.mockImplementation(() => { throw new Error('no app') })
    expect(await (await load())()).toBeNull()

    vi.resetModules()
    getApp.mockReturnValue({ name: 'app' })
    initializeAppCheck.mockImplementationOnce(() => { throw new Error('blocked') })
    expect(await (await load())()).toBeNull()
  })
})
