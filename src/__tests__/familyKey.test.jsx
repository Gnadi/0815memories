/* useFamilyKey on its own: the key and the card style from the family
   document, without the rest of the session around them. firstLoginKey.test
   covers the same hook through AuthProvider — the races of a first login and
   the retries. These are the rules it keeps whoever calls it. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

let next = null
const subscribeFamily = vi.fn((_familyId, onData) => {
  next = onData
  return () => {}
})
vi.mock('../services/family', () => ({ subscribeFamily: (...args) => subscribeFamily(...args) }))
vi.mock('../config/firebase', () => ({ db: {} }))
const importEncryptionKey = vi.fn(async (jwk) => ({ imported: jwk.k }))
vi.mock('../utils/encryption', () => ({ importEncryptionKey: (...args) => importEncryptionKey(...args) }))

const { useFamilyKey } = await import('../context/useFamilyKey')

const USER = { uid: 'uid-a' }
const refreshClaims = vi.fn(async () => null)

function render(familyId = 'fam-a') {
  return renderHook(({ id }) => useFamilyKey(id, USER, refreshClaims), { initialProps: { id: familyId } })
}

beforeEach(() => {
  vi.clearAllMocks()
  next = null
  window.localStorage.clear()
})

describe('useFamilyKey', () => {
  it("imports the family's key, once, and takes the card style along", async () => {
    const { result } = render()
    expect(result.current.keyLoading).toBe(true)

    const family = { encryptionKeyJwk: { kty: 'oct', k: 'a' }, memoryCardStyle: 'polaroid' }
    await act(async () => { await next(family) })
    expect(result.current).toMatchObject({
      encryptionKey: { imported: 'a' }, keyLoading: false, keyError: null, memoryCardStyle: 'polaroid',
    })

    // Every snapshot after that leaves the key alone: a new CryptoKey would
    // restart every listener and decrypt that depends on it.
    await act(async () => { await next({ ...family, memoryCardStyle: 'classic' }) })
    expect(importEncryptionKey).toHaveBeenCalledTimes(1)
    expect(result.current.memoryCardStyle).toBe('classic')
  })

  it('keeps the gate shut and says why when the family has no key', async () => {
    const { result } = render()
    await act(async () => { await next({ familyName: 'The Millers' }) })
    expect(result.current).toMatchObject({ encryptionKey: null, keyLoading: true, keyError: 'missing' })
  })

  it('closes the app on a family its owner deleted, key or no key', async () => {
    const { result } = render()
    await act(async () => { await next({ encryptionKeyJwk: { kty: 'oct', k: 'a' } }) })
    expect(result.current.keyError).toBeNull()

    // functions/familyDeletion.js takes the key off and marks the family.
    await act(async () => { await next({ deletionRequestedAt: new Date() }) })
    expect(result.current.keyError).toBe('deleted')
  })

  it("drops one family's key the moment the session moves to another", async () => {
    const { result, rerender } = render('fam-a')
    await act(async () => { await next({ encryptionKeyJwk: { kty: 'oct', k: 'a' } }) })
    expect(result.current.encryptionKey).toEqual({ imported: 'a' })

    rerender({ id: 'fam-b' })
    expect(result.current).toMatchObject({ encryptionKey: null, keyLoading: true })
    await act(async () => { await next({ encryptionKeyJwk: { kty: 'oct', k: 'b' } }) })
    expect(result.current.encryptionKey).toEqual({ imported: 'b' })
  })

  it('settles at once on a key made at signup, and forgets it all on sign-out', async () => {
    const { result, rerender } = render(null)
    act(() => result.current.adoptKey('fam-new', { generated: true }))
    rerender({ id: 'fam-new' })
    expect(result.current).toMatchObject({ encryptionKey: { generated: true }, keyLoading: false })
    expect(importEncryptionKey).not.toHaveBeenCalled()

    act(() => result.current.forgetKey())
    expect(result.current).toMatchObject({ encryptionKey: null, keyError: null, memoryCardStyle: 'modern' })
  })
})
