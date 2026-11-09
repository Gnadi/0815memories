/**
 * Tests for functions/adminClaims.js — claims follow the current family
 * document, not the order in which trigger events happen to arrive.
 */
import { describe, expect, it } from 'vitest'
import { syncClaimsForFamily } from '../../functions/adminClaims.js'

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

  it('carries on with the other uids when one fails, then fails so the trigger retries', async () => {
    const { calls, run } = setup({ current: { adminUids: ['a', 'b', 'c'] } })
    const failing = {
      doc: () => ({ get: async () => ({ exists: true, data: () => ({ adminUids: ['a', 'b', 'c'] }) }) }),
    }
    const auth = {
      setCustomUserClaims: async (uid, value) => {
        if (uid === 'b') throw new Error('boom')
        calls.push(['set', uid, value])
      },
    }
    await expect(
      syncClaimsForFamily({ db: failing, auth }, {
        familyId: FAMILY,
        before: { adminUids: ['a'] },
        after: { adminUids: ['a', 'b', 'c'] },
      }),
    ).rejects.toThrow('boom')
    expect(calls).toEqual([['set', 'c', admin]])
    expect(run).toBeTypeOf('function')
  })
})
