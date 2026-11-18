// @vitest-environment node
/**
 * checkViewerLogin (functions/viewerLogin.js) on an in-memory Firestore: the
 * order of its steps, which viewerLoginRules.test.js checks against the
 * emulator. Here, that the expensive comparison never runs for an attempt the
 * throttle refused, and that a right password comes away with its token and
 * device whatever order the closing writes finish in.
 */
import { describe, it, expect, vi } from 'vitest'
import { createHash } from 'node:crypto'
import {
  checkViewerLogin,
  DEVICES,
  MAX_ATTEMPTS_PER_DAY,
  safeKey,
} from '../../functions/viewerLogin.js'
import { fakeAdminFirestore } from './fakeAdminFirestore.js'

const FAMILY = 'fam-1'
const NOW = Date.parse('2026-11-18T10:00:00Z')

function setup(seed = {}) {
  const db = fakeAdminFirestore({
    [`families/${FAMILY}`]: { viewerSessionVersion: 3 },
    [`families/${FAMILY}/secrets/auth`]: { sharedPassword: 'hash-of-right' },
    ...seed,
  })
  const compare = vi.fn(async (password, hash) => hash === `hash-of-${password}`)
  const mintToken = vi.fn(async (familyId, sv) => `token:${familyId}:${sv}`)
  return { db, compare, mintToken, now: () => NOW }
}

describe('checkViewerLogin', () => {
  it('signs in with the right password: a token with the session version, a new device, the counter cleared', async () => {
    const deps = setup()
    const result = await checkViewerLogin(deps, { familyId: FAMILY, password: 'right' })

    expect(result).toMatchObject({ outcome: 'ok', token: `token:${FAMILY}:3` })
    expect(result.deviceToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const hash = createHash('sha256').update(result.deviceToken).digest('hex')
    expect(deps.db.collectionData(DEVICES)).toHaveProperty(hash)
    expect(deps.db.collectionData(DEVICES)[hash]).toMatchObject({ familyId: FAMILY, sv: 3 })
    expect(deps.db.docs.has(`rateLimits/${safeKey('viewerLogin', FAMILY)}`)).toBe(false)
  })

  it('refuses a wrong password, having compared it', async () => {
    const deps = setup()
    await expect(checkViewerLogin(deps, { familyId: FAMILY, password: 'wrong' })).resolves.toEqual({ outcome: 'denied' })
    expect(deps.compare).toHaveBeenCalledTimes(1)
    expect(deps.mintToken).not.toHaveBeenCalled()
    expect(deps.db.collectionData(DEVICES)).toEqual({})
  })

  it('does not compare once the day’s attempts are used up, though the hash is at hand', async () => {
    const attempts = Array.from({ length: MAX_ATTEMPTS_PER_DAY }, (_, i) => NOW - 1000 - i)
    const deps = setup({ [`rateLimits/${safeKey('viewerLoginBudget', FAMILY)}`]: { attempts } })
    await expect(checkViewerLogin(deps, { familyId: FAMILY, password: 'right' })).resolves.toEqual({ outcome: 'blocked' })
    expect(deps.compare).not.toHaveBeenCalled()
    expect(deps.mintToken).not.toHaveBeenCalled()
  })

  it('fails the sign-in when the token cannot be minted', async () => {
    const deps = setup()
    deps.mintToken.mockRejectedValue(new Error('signBlob failed'))
    await expect(checkViewerLogin(deps, { familyId: FAMILY, password: 'right' })).rejects.toThrow('signBlob failed')
  })
})
