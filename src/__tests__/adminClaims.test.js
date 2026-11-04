// @vitest-environment node
/**
 * The admin claim follows the family document, whatever order the trigger's
 * events arrive in — functions/adminClaims.js.
 *
 * Firestore triggers are retried and not ordered. Deciding from each event's
 * before/after let a late "added" give a removed admin their claim back, and
 * nothing would ever take it away again.
 */
import { describe, it, expect } from 'vitest'
import { reconcileAdminClaims } from '../../functions/adminClaims.js'

const FAMILY = 'fam-1'

function fakes({ adminUids, claims = {} }) {
  const state = { adminUids, claims: { ...claims }, revoked: [] }
  const db = {
    doc: (path) => ({
      get: async () => {
        expect(path).toBe(`families/${FAMILY}`)
        return { exists: true, data: () => ({ adminUid: 'owner', adminUids: state.adminUids }) }
      },
    }),
  }
  const auth = {
    setCustomUserClaims: async (uid, value) => { state.claims[uid] = value },
    getUser: async (uid) => ({ uid, customClaims: state.claims[uid] ?? null }),
    revokeRefreshTokens: async (uid) => { state.revoked.push(uid) },
  }
  return { state, deps: { db, auth } }
}

const event = (before, after) => ({ before: { adminUids: before }, after: { adminUids: after } })
const ADDED_B = event(['owner'], ['owner', 'b'])
const REMOVED_B = event(['owner', 'b'], ['owner'])

describe('reconcileAdminClaims', () => {
  it('grants the claim to an admin who was added', async () => {
    const { state, deps } = fakes({ adminUids: ['owner', 'b'] })
    await reconcileAdminClaims(deps, FAMILY, ADDED_B)
    expect(state.claims.b).toEqual({ familyId: FAMILY, role: 'admin' })
  })

  it('clears and revokes the claim of an admin who was removed', async () => {
    const { state, deps } = fakes({ adminUids: ['owner'], claims: { b: { familyId: FAMILY, role: 'admin' } } })
    await reconcileAdminClaims(deps, FAMILY, REMOVED_B)
    expect(state.claims.b).toBeNull()
    expect(state.revoked).toEqual(['b'])
  })

  it('does not hand a removed admin their claim back when the "added" event arrives late', async () => {
    // b was added and then removed; the trigger sees the removal first.
    const { state, deps } = fakes({ adminUids: ['owner'], claims: { b: { familyId: FAMILY, role: 'admin' } } })
    await reconcileAdminClaims(deps, FAMILY, REMOVED_B)
    await reconcileAdminClaims(deps, FAMILY, ADDED_B)
    expect(state.claims.b).toBeNull()
  })

  it('does not take the claim from an admin added again when the "removed" event arrives late', async () => {
    const { state, deps } = fakes({ adminUids: ['owner', 'b'] })
    await reconcileAdminClaims(deps, FAMILY, ADDED_B)
    await reconcileAdminClaims(deps, FAMILY, REMOVED_B)
    expect(state.claims.b).toEqual({ familyId: FAMILY, role: 'admin' })
  })

  it('leaves the claim of an admin who has since moved to another family', async () => {
    const { state, deps } = fakes({ adminUids: ['owner'], claims: { b: { familyId: 'fam-2', role: 'admin' } } })
    await reconcileAdminClaims(deps, FAMILY, REMOVED_B)
    expect(state.claims.b).toEqual({ familyId: 'fam-2', role: 'admin' })
    expect(state.revoked).toEqual([])
  })

  it('reads nothing for a write that changed no admins', async () => {
    const { deps } = fakes({ adminUids: ['owner'] })
    deps.db.doc = () => { throw new Error('should not read') }
    await expect(reconcileAdminClaims(deps, FAMILY, event(['owner'], ['owner']))).resolves.toEqual({ granted: [], cleared: [] })
  })
})
