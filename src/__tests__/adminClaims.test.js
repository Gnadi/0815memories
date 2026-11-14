/**
 * Tests for functions/adminClaims.js — claims follow the current family
 * document, not the order in which trigger events happen to arrive.
 */
import { describe, expect, it } from 'vitest'
import { reconcileAdminClaims, syncClaimsForFamily } from '../../functions/adminClaims.js'

const FAMILY = 'fam1'

function setup({ current, claims = {} }) {
  const calls = []
  const db = {
    doc: () => ({
      get: async () => ({ exists: current !== null, data: () => current }),
    }),
  }
  const auth = {
    getUser: async (uid) => ({ uid, customClaims: claims[uid] }),
    setCustomUserClaims: async (uid, value) => calls.push(['set', uid, value]),
    revokeRefreshTokens: async (uid) => calls.push(['revoke', uid]),
  }
  const run = (before, after) =>
    syncClaimsForFamily({ db, auth }, { familyId: FAMILY, before, after })
  return { calls, run }
}

const admin = { familyId: FAMILY, role: 'admin' }

describe('syncClaimsForFamily', () => {
  it('sets the claim when an admin is added', async () => {
    const { calls, run } = setup({ current: { adminUids: ['a', 'b'] } })
    await run({ adminUids: ['a'] }, { adminUids: ['a', 'b'] })
    expect(calls).toEqual([['set', 'b', admin]])
  })

  it('clears and revokes when an admin is removed', async () => {
    const { calls, run } = setup({
      current: { adminUids: ['a'] },
      claims: { b: admin },
    })
    await run({ adminUids: ['a', 'b'] }, { adminUids: ['a'] })
    expect(calls).toEqual([['set', 'b', null], ['revoke', 'b']])
  })

  it('does not re-grant admin on a late "added" event after the removal', async () => {
    const { calls, run } = setup({
      current: { adminUids: ['a'] },
      claims: { b: admin },
    })
    await run({ adminUids: ['a'] }, { adminUids: ['a', 'b'] })
    expect(calls).toEqual([['set', 'b', null], ['revoke', 'b']])
  })

  it('leaves a claim that points at another family', async () => {
    const { calls, run } = setup({
      current: { adminUids: ['a'] },
      claims: { b: { familyId: 'other', role: 'admin' } },
    })
    await run({ adminUids: ['a', 'b'] }, { adminUids: ['a'] })
    expect(calls).toEqual([])
  })

  it('keeps the claim of an admin removed and then re-added', async () => {
    const { calls, run } = setup({
      current: { adminUids: ['a', 'b'] },
      claims: { b: admin },
    })
    // The late removal event, delivered after the re-adding write.
    await run({ adminUids: ['a', 'b'] }, { adminUids: ['a'] })
    expect(calls).toEqual([['set', 'b', admin]])
  })

  it('clears every changed admin when the family document is deleted', async () => {
    const { calls, run } = setup({
      current: null,
      claims: { a: admin, b: admin },
    })
    await run({ adminUids: ['a', 'b'] }, null)
    // The uids are handled concurrently, so only the set of calls is fixed.
    expect(calls).toHaveLength(4)
    expect(calls).toEqual(
      expect.arrayContaining([
        ['set', 'a', null],
        ['revoke', 'a'],
        ['set', 'b', null],
        ['revoke', 'b'],
      ]),
    )
  })

  it('throws when a set fails but still processes the other uids', async () => {
    const calls = []
    const db = {
      doc: () => ({ get: async () => ({ exists: true, data: () => ({ adminUids: ['a', 'b', 'c'] }) }) }),
    }
    const auth = {
      setCustomUserClaims: async (uid, value) => {
        if (uid === 'b') throw Object.assign(new Error('boom'), { code: 'auth/internal-error' })
        calls.push(['set', uid, value])
      },
    }
    await expect(
      syncClaimsForFamily({ db, auth }, {
        familyId: FAMILY,
        before: { adminUids: [] },
        after: { adminUids: ['a', 'b', 'c'] },
      }),
    ).rejects.toThrow()
    expect(calls).toEqual(
      expect.arrayContaining([['set', 'a', admin], ['set', 'c', admin]]),
    )
    expect(calls).toHaveLength(2)
  })

  it('does not treat a deleted user as a failure', async () => {
    const gone = Object.assign(new Error('no user'), { code: 'auth/user-not-found' })
    const db = {
      doc: () => ({ get: async () => ({ exists: true, data: () => ({ adminUids: ['a'] }) }) }),
    }
    const auth = {
      getUser: async () => { throw gone },
      setCustomUserClaims: async () => { throw gone },
    }
    await expect(
      syncClaimsForFamily({ db, auth }, {
        familyId: FAMILY,
        before: { adminUids: ['a', 'b'] },
        after: { adminUids: ['a'] },
      }),
    ).resolves.toBeUndefined()
  })
})

describe('reconcileAdminClaims', () => {
  // `families` is what the pass lists at its start; `familiesNow` is what a
  // single family reads as afterwards, for a change made while the pass runs.
  function setupReconcile({ families, familiesNow = families, users, failFor = [] }) {
    const calls = []
    const db = {
      collection: () => ({
        get: async () => ({
          forEach: (fn) => Object.entries(families).forEach(([id, data]) => fn({ id, data: () => data })),
        }),
      }),
      doc: (path) => ({
        get: async () => {
          const data = familiesNow[path.replace('families/', '')]
          return { exists: !!data, data: () => data }
        },
      }),
    }
    const auth = {
      getUser: async (uid) => {
        if (!(uid in users)) throw Object.assign(new Error('none'), { code: 'auth/user-not-found' })
        return { uid, customClaims: users[uid] }
      },
      listUsers: async () => ({
        users: Object.entries(users).map(([uid, customClaims]) => ({ uid, customClaims })),
      }),
      setCustomUserClaims: async (uid, value) => {
        if (failFor.includes(uid)) throw new Error('boom')
        calls.push(['set', uid, value])
      },
      revokeRefreshTokens: async (uid) => calls.push(['revoke', uid]),
    }
    return { calls, run: () => reconcileAdminClaims({ db, auth }) }
  }

  it('grants a missing claim and skips users that no longer exist', async () => {
    const { calls, run } = setupReconcile({
      families: { [FAMILY]: { adminUids: ['a', 'ghost'] } },
      users: { a: undefined },
    })
    const stats = await run()
    expect(calls).toEqual([['set', 'a', admin]])
    expect(stats).toEqual({ families: 1, granted: 1, cleared: 0, failed: 0 })
  })

  it('clears and revokes a stale claim', async () => {
    const { calls, run } = setupReconcile({
      families: { [FAMILY]: { adminUids: ['a'] } },
      users: { a: admin, old: admin },
    })
    const stats = await run()
    expect(calls).toEqual([['set', 'old', null], ['revoke', 'old']])
    expect(stats.cleared).toBe(1)
  })

  it('leaves viewers, claimless users and correct claims alone', async () => {
    const { calls, run } = setupReconcile({
      families: { [FAMILY]: { adminUids: ['a'] } },
      users: {
        a: admin,
        'viewer:fam1': { familyId: FAMILY, role: 'viewer' },
        plain: undefined,
      },
    })
    await run()
    expect(calls).toEqual([])
  })

  it('keeps a claim that points at another family that still lists the user', async () => {
    const { calls, run } = setupReconcile({
      families: { [FAMILY]: { adminUids: ['a'] }, fam2: { adminUids: ['a'] } },
      users: { a: { familyId: 'fam2', role: 'admin' } },
    })
    await run()
    expect(calls).toEqual([])
  })

  it('finishes the pass when one user fails, then reports it', async () => {
    const { calls, run } = setupReconcile({
      families: { [FAMILY]: { adminUids: ['a', 'b'] } },
      users: { a: undefined, b: undefined, old: admin },
      failFor: ['a'],
    })
    await expect(run()).rejects.toThrow(/1 user/)
    expect(calls).toEqual([['set', 'b', admin], ['set', 'old', null], ['revoke', 'old']])
  })

  it('judges someone who joined or left during the pass by the family as it is now', async () => {
    const { calls, run } = setupReconcile({
      families: { fam: { adminUids: ['left'] } },
      familiesNow: { fam: { adminUids: ['joined'] } },
      users: { left: null, joined: { familyId: 'fam', role: 'admin' } },
    })
    await run()
    // `left` gets no claim although the list still named them, and `joined`
    // keeps theirs although the list did not know them yet.
    expect(calls).toEqual([])
  })
})
