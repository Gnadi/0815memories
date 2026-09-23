/* docs/moments-decryption.md §1.

   `thumbsTiny` is written by the shared upload path and the shared thumbnail
   backfill, both of which encrypt it for moments exactly as they do for
   memories. Nothing on the moments read path decrypted it again, so every
   moment card handed ~1 KB of ciphertext to an <img src>: no blur-up, and the
   browser resolving that base64 as a relative URL and fetching it.

   Real crypto here, not a stub. A stub that "decrypts" by stripping a prefix
   would have passed against the broken code too, because the broken code
   returned the field untouched. */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { webcrypto } from 'node:crypto'
import { renderHook, act } from '@testing-library/react'

let onNext = null
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ name })),
  query: vi.fn((ref, ...c) => ({ ref, c })),
  orderBy: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(async () => ({ id: 'new' })),
  updateDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  onSnapshot: vi.fn((_q, next) => {
    onNext = next
    return () => {}
  }),
}))
vi.mock('../config/firebase', () => ({ db: {} }))

import {
  generateEncryptionKey,
  encryptText,
  decryptText,
  clearDecryptedTextCache,
} from '../utils/encryption'
import { useMoments, useAllMoments } from '../hooks/useMemories'
import { tinyPreviewAt } from '../utils/mediaThumbs'

// jsdom has no working crypto.subtle — graft Node's on, as encryption.test.js does.
beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
  }
})

let key
const PREVIEW = 'data:image/webp;base64,UklGRhoAAABXRUJQ'
const IMAGE = 'https://res.cloudinary.com/demo/raw/upload/orig.dat'

beforeEach(async () => {
  vi.clearAllMocks()
  clearDecryptedTextCache()
  onNext = null
  if (!key) ({ key } = await generateEncryptionKey())
})

// A snapshot shaped the way Firestore hands one over.
function snapshot(...docs) {
  return { docs: docs.map(({ id, ...data }) => ({ id, data: () => data })) }
}

// The snapshot handler is async — awaiting the promise it returns is what
// waits for the decrypt, rather than guessing at a number of ticks.
async function emit(snap) {
  await act(async () => {
    await onNext(snap)
  })
}

describe('useMoments', () => {
  it('decrypts thumbsTiny into a usable data URL', async () => {
    const ciphertext = await encryptText(key, PREVIEW)
    // The blur-up is worthless if the ciphertext is what reaches the element.
    expect(ciphertext).not.toBe(PREVIEW)

    const { result } = renderHook(() => useMoments('fam-1', key))
    await emit(snapshot({ id: 'm1', images: [IMAGE], thumbsTiny: [ciphertext] }))

    const moment = result.current.moments[0]
    expect(moment.thumbsTiny).toEqual([PREVIEW])
    // What the card actually asks for.
    expect(tinyPreviewAt(moment, 0)).toBe(PREVIEW)
  })

  it('decrypts each entry of a multi-photo moment, in order', async () => {
    const previews = [`${PREVIEW}AA`, `${PREVIEW}BB`, `${PREVIEW}CC`]
    const thumbsTiny = await Promise.all(previews.map((p) => encryptText(key, p)))

    const { result } = renderHook(() => useMoments('fam-1', key))
    await emit(snapshot({ id: 'm1', images: [IMAGE, IMAGE, IMAGE], thumbsTiny }))

    expect(result.current.moments[0].thumbsTiny).toEqual(previews)
  })

  it('leaves a moment without previews exactly as it arrived', async () => {
    const { result } = renderHook(() => useMoments('fam-1', key))
    await emit(snapshot({ id: 'm1', caption: 'Beach day', images: [IMAGE] }))

    // Moments keep their text in clear; the decrypt pass must not disturb it.
    expect(result.current.moments[0]).toEqual({ id: 'm1', caption: 'Beach day', images: [IMAGE] })
  })

  it('passes the document through untouched without a key', async () => {
    const ciphertext = await encryptText(key, PREVIEW)
    const { result } = renderHook(() => useMoments('fam-1', null))
    await emit(snapshot({ id: 'm1', images: [IMAGE], thumbsTiny: [ciphertext] }))

    expect(result.current.moments[0].thumbsTiny).toEqual([ciphertext])
    // And the guard in tinyPreviewAt keeps that ciphertext out of the element.
    expect(tinyPreviewAt(result.current.moments[0], 0)).toBe('')
  })

  it('keeps the newest snapshot when an earlier one decrypts more slowly', async () => {
    const stale = await encryptText(key, `${PREVIEW}OLD`)
    const fresh = await encryptText(key, `${PREVIEW}NEW`)

    // Seed the memo for the *second* snapshot's preview so it resolves from the
    // Map while the first is still in crypto.subtle — which is the real case:
    // a Firestore re-emit whose previews are all already decrypted beats a cold
    // first load, and used to overwrite it with stale data on arrival.
    await decryptText(key, fresh)

    const { result } = renderHook(() => useMoments('fam-1', key))
    await act(async () => {
      const cold = onNext(snapshot({ id: 'm1', images: [IMAGE], thumbsTiny: [stale] }))
      const warm = onNext(snapshot({ id: 'm1', images: [IMAGE], thumbsTiny: [fresh] }))
      await Promise.all([warm, cold])
    })

    expect(result.current.moments[0].thumbsTiny).toEqual([`${PREVIEW}NEW`])
  })
})

describe('useAllMoments', () => {
  it('decrypts thumbsTiny the same way the home row does', async () => {
    const ciphertext = await encryptText(key, PREVIEW)
    const { result } = renderHook(() => useAllMoments('fam-1', key))
    await emit(snapshot({ id: 'm1', images: [IMAGE], thumbsTiny: [ciphertext] }))

    expect(tinyPreviewAt(result.current.moments[0], 0)).toBe(PREVIEW)
  })
})
