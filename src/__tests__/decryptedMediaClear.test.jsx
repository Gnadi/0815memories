/* A decrypt that is still running when the session ends must not put its
   plaintext back into the cache the logout just emptied. Real AES-GCM here: the
   point is that the job really did decrypt, and the result is still dropped. */
import { webcrypto } from 'node:crypto'
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

let authState = { encryptionKey: null, keyLoading: false }
vi.mock('../context/AuthContext', () => ({ useAuth: () => authState }))
vi.mock('../utils/devLog', () => ({ devError: vi.fn(), devWarn: vi.fn() }))

import { generateEncryptionKey, encryptBlob } from '../utils/encryption'
import useDecryptedMedia, {
  clearDecryptedMediaCache,
  prefetchDecryptedMedia,
  peekDecryptedMedia,
} from '../components/media/useDecryptedMedia'

const URL_A = 'https://res.cloudinary.com/demo/raw/upload/kaydo/encrypted/a.dat'

let key
let ciphertext
let held
let objectUrlCounter

// A JPEG header, so the decrypted blob is recognisable as what it is.
const PLAIN = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

// jsdom has no functional crypto.subtle; Node's webcrypto stands in for it.
beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
  }
})

beforeEach(async () => {
  clearDecryptedMediaCache()
  objectUrlCounter = 0
  URL.createObjectURL = vi.fn(() => `blob:decrypted-${++objectUrlCounter}`)
  URL.revokeObjectURL = vi.fn()

  ;({ key } = await generateEncryptionKey())
  ciphertext = await encryptBlob(key, { arrayBuffer: async () => PLAIN.buffer.slice(0) })

  // Every response is held back until the test lets it go.
  held = []
  globalThis.fetch = vi.fn(() => new Promise((resolve) => {
    held.push(() => resolve({ ok: true, arrayBuffer: async () => ciphertext.slice(0) }))
  }))
  authState = { encryptionKey: key, keyLoading: false }
})

afterEach(() => {
  clearDecryptedMediaCache()
})

describe('a decrypt that was running when the cache was cleared', () => {
  it('does not refill the cache (prefetch)', async () => {
    const result = prefetchDecryptedMedia(URL_A, key)
    await waitFor(() => expect(held).toHaveLength(1))

    clearDecryptedMediaCache()
    held[0]()

    await expect(result).resolves.toBeNull()
    expect(peekDecryptedMedia(URL_A)).toBeNull()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('does not refill the cache (on-screen media)', async () => {
    const { result } = renderHook(() => useDecryptedMedia(URL_A, 'image/*'))
    await waitFor(() => expect(held).toHaveLength(1))

    clearDecryptedMediaCache()
    held[0]()

    await waitFor(() => expect(result.current.error).toBeTruthy())
    expect(peekDecryptedMedia(URL_A)).toBeNull()
    expect(result.current.decryptedUrl).toBeNull()
  })

  it('is not handed to a request made after the clear, which loads afresh', async () => {
    const stale = prefetchDecryptedMedia(URL_A, key)
    await waitFor(() => expect(held).toHaveLength(1))
    clearDecryptedMediaCache()

    const fresh = prefetchDecryptedMedia(URL_A, key)
    await waitFor(() => expect(held).toHaveLength(2))
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)

    // The old job finishing first must neither store nor drop the new request.
    held[0]()
    await expect(stale).resolves.toBeNull()
    expect(peekDecryptedMedia(URL_A)).toBeNull()

    held[1]()
    await expect(fresh).resolves.toBe('blob:decrypted-1')
    expect(peekDecryptedMedia(URL_A)).toBe('blob:decrypted-1')
  })
})
