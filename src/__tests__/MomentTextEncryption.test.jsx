/**
 * The background run that encrypts a family's moments from before their text
 * was encrypted (components/admin/MomentTextEncryption.jsx): an admin's tab,
 * with the key, outside the demo, once per family and tab — and again in a
 * later tab when this one could not finish.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

let auth
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))
const encryptFamilyMoments = vi.fn()
vi.mock('../services/momentEncryption', () => ({ encryptFamilyMoments: (...a) => encryptFamilyMoments(...a) }))
vi.mock('../utils/devLog', () => ({ devError: vi.fn() }))

const KEY = { type: 'secret' }

// The tab's memory of which families it has done lives in the module, so each
// test loads a fresh copy.
async function freshComponent() {
  vi.resetModules()
  return (await import('../components/admin/MomentTextEncryption')).default
}

beforeEach(() => {
  encryptFamilyMoments.mockReset()
  encryptFamilyMoments.mockResolvedValue({ encrypted: 2, failed: 0 })
  auth = { familyId: 'fam-1', encryptionKey: KEY, isAdmin: true, isDemo: false }
})

describe('MomentTextEncryption', () => {
  it('runs for an admin with the family key', async () => {
    const MomentTextEncryption = await freshComponent()
    render(<MomentTextEncryption />)
    await waitFor(() => expect(encryptFamilyMoments).toHaveBeenCalledTimes(1))
    expect(encryptFamilyMoments.mock.calls[0].slice(0, 2)).toEqual(['fam-1', KEY])
  })

  it.each([
    ['a viewer', { isAdmin: false }],
    ['the demo', { isDemo: true }],
    ['a tab without the key yet', { encryptionKey: null }],
  ])('does nothing for %s', async (_name, change) => {
    auth = { ...auth, ...change }
    const MomentTextEncryption = await freshComponent()
    render(<MomentTextEncryption />)
    await new Promise((r) => setTimeout(r, 0))
    expect(encryptFamilyMoments).not.toHaveBeenCalled()
  })

  it('runs once per family and tab', async () => {
    const MomentTextEncryption = await freshComponent()
    const first = render(<MomentTextEncryption />)
    await waitFor(() => expect(encryptFamilyMoments).toHaveBeenCalledTimes(1))
    first.unmount()
    render(<MomentTextEncryption />)
    await new Promise((r) => setTimeout(r, 0))
    expect(encryptFamilyMoments).toHaveBeenCalledTimes(1)
  })

  it('tries again after a run that left moments in clear', async () => {
    encryptFamilyMoments.mockResolvedValueOnce({ encrypted: 1, failed: 1 })
    const MomentTextEncryption = await freshComponent()
    const first = render(<MomentTextEncryption />)
    await waitFor(() => expect(encryptFamilyMoments).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 0))
    first.unmount()
    render(<MomentTextEncryption />)
    await waitFor(() => expect(encryptFamilyMoments).toHaveBeenCalledTimes(2))
  })
})
