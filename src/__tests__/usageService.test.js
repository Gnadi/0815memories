/**
 * The usage log's client (services/usage.js): when it writes, when it must not,
 * and that it never gets in the way.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const addDoc = vi.fn()
vi.mock('../config/firestore', () => ({
  addDoc: (...a) => addDoc(...a),
  collection: (_db, name) => ({ name }),
  serverTimestamp: () => 'SERVER_TIME',
  Timestamp: { fromMillis: (ms) => ({ ms }) },
}))
const firebase = vi.hoisted(() => ({ db: {} }))
vi.mock('../config/firebase', () => ({
  get db() { return firebase.db },
}))
const demo = vi.hoisted(() => ({ on: false }))
vi.mock('../demo/demoMode', () => ({ isDemoMode: () => demo.on }))

import {
  trackEvent, setUsageContext, setUsageOptedOut, isUsageOptedOut, resetUsageForTests,
} from '../services/usage'

const written = () => addDoc.mock.calls.map(([, data]) => data)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  resetUsageForTests()
  firebase.db = {}
  demo.on = false
  addDoc.mockResolvedValue({})
})

describe('trackEvent', () => {
  it('writes an event with the family, the role and nothing else about the person', () => {
    setUsageContext({ familyId: 'fam1', role: 'admin' })
    addDoc.mockClear() // session_started
    trackEvent('item_created', { kind: 'recipe' })

    expect(addDoc).toHaveBeenCalledTimes(1)
    const [ref, data] = addDoc.mock.calls[0]
    expect(ref).toEqual({ name: 'usageEvents' })
    expect(data).toMatchObject({
      familyId: 'fam1', role: 'admin', name: 'item_created', props: { kind: 'recipe' },
      createdAt: 'SERVER_TIME', standalone: false,
    })
    expect(Object.keys(data).sort()).toEqual([
      'createdAt', 'expireAt', 'familyId', 'lang', 'name', 'props', 'role', 'session', 'standalone',
    ])
    expect(data.expireAt.ms).toBeGreaterThan(Date.now() + 80 * 24 * 60 * 60 * 1000)
  })

  it('announces the session once, when the family becomes known', () => {
    setUsageContext({ familyId: 'fam1', role: 'viewer' })
    setUsageContext({ familyId: 'fam1', role: 'viewer' })
    expect(written().map((d) => d.name)).toEqual(['session_started'])
  })

  it('holds events until the session knows its family, then sends them', () => {
    trackEvent('family_created')
    trackEvent('pwa_installed')
    expect(addDoc).not.toHaveBeenCalled()

    setUsageContext({ familyId: 'fam1', role: 'admin' })
    expect(written().map((d) => d.name).sort()).toEqual(['family_created', 'pwa_installed', 'session_started'])
    expect(new Set(written().map((d) => d.session)).size).toBe(1)
  })

  it('writes nothing for a signed-out visitor, and the queue does not grow without end', () => {
    for (let i = 0; i < 100; i += 1) trackEvent('error_shown', { area: 'route' })
    setUsageContext({ familyId: 'fam1', role: 'admin' })
    expect(addDoc.mock.calls.length).toBeLessThanOrEqual(21)
  })

  it('waits for a role it can vouch for', () => {
    setUsageContext({ familyId: 'fam1', role: null })
    trackEvent('feature_opened', { feature: 'feed' })
    expect(addDoc).not.toHaveBeenCalled()
  })

  it('writes nothing in the demo', () => {
    demo.on = true
    setUsageContext({ familyId: 'fam1', role: 'admin' })
    trackEvent('item_created', { kind: 'recipe' })
    expect(addDoc).not.toHaveBeenCalled()
  })

  it('writes nothing without Firebase', () => {
    firebase.db = null
    setUsageContext({ familyId: 'fam1', role: 'admin' })
    trackEvent('item_created', { kind: 'recipe' })
    expect(addDoc).not.toHaveBeenCalled()
  })

  it('refuses what the rules would refuse', () => {
    setUsageContext({ familyId: 'fam1', role: 'admin' })
    addDoc.mockClear()
    trackEvent('item_created', { kind: 'Omas Apfelkuchen' })
    trackEvent('not_an_event')
    expect(addDoc).not.toHaveBeenCalled()
  })

  it('forgets the family on sign-out, so the next person is not recorded as them', () => {
    setUsageContext({ familyId: 'fam1', role: 'admin' })
    setUsageContext({ familyId: null, role: null })
    addDoc.mockClear()
    trackEvent('feature_opened', { feature: 'feed' })
    expect(addDoc).not.toHaveBeenCalled()
    setUsageContext({ familyId: 'fam2', role: 'viewer' })
    expect(written().every((d) => d.familyId === 'fam2')).toBe(true)
  })

  it('never throws or rejects, whatever the write does', async () => {
    setUsageContext({ familyId: 'fam1', role: 'admin' })
    addDoc.mockRejectedValue(Object.assign(new Error('denied'), { code: 'permission-denied' }))
    expect(() => trackEvent('item_created', { kind: 'recipe' })).not.toThrow()
    addDoc.mockImplementation(() => { throw new Error('sync failure') })
    expect(() => trackEvent('item_created', { kind: 'recipe' })).not.toThrow()
    await Promise.resolve()
  })
})

describe('opting out', () => {
  it('remembers the choice on this device', () => {
    expect(isUsageOptedOut()).toBe(false)
    setUsageOptedOut(true)
    expect(isUsageOptedOut()).toBe(true)
    setUsageOptedOut(false)
    expect(isUsageOptedOut()).toBe(false)
  })

  it('stops writing, and drops what was waiting', () => {
    trackEvent('pwa_installed')
    setUsageOptedOut(true)
    setUsageContext({ familyId: 'fam1', role: 'admin' })
    trackEvent('item_created', { kind: 'recipe' })
    expect(addDoc).not.toHaveBeenCalled()
  })
})
