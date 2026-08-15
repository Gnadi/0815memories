/* docs/media-performance.md §3. `useDecryptedMedia` had one 6-slot lane, and
   prefetchDecryptedMedia queued into the same one — so opening a lightbox while
   the feed was still filling put the photo the user was looking at behind up to
   six off-screen warm-ups, and a full-resolution original behind a queue of
   thumbnails is a wait measured in seconds.

   These drive the scheduler directly with controllable fetches, because the
   ordering is the whole point and it is invisible from the rendered output. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../utils/encryption', () => ({ decryptBlob: vi.fn() }))
vi.mock('../utils/devLog', () => ({ devError: vi.fn(), devWarn: vi.fn() }))
const KEY = { fake: 'key' }
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ encryptionKey: KEY, keyLoading: false }),
}))
vi.mock('../utils/decryptPool', () => ({
  decryptBlobOffThread: vi.fn(async () => new Blob([new Uint8Array(16)], { type: 'image/jpeg' })),
}))

import { renderHook } from '@testing-library/react'
import useDecryptedMedia, {
  prefetchDecryptedMedia,
  clearDecryptedMediaCache,
  __queueDepths,
} from '../components/media/useDecryptedMedia'

const url = (n) => `https://res.cloudinary.com/demo/raw/upload/x${n}.dat`

// Fetches that only resolve when the test says so, so queue state can be
// observed while jobs are in flight.
let gates

function gate(u) {
  if (!gates.has(u)) {
    let release
    const promise = new Promise((r) => { release = r })
    gates.set(u, { promise, release })
  }
  return gates.get(u)
}

beforeEach(() => {
  clearDecryptedMediaCache()
  gates = new Map()
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
  globalThis.fetch = vi.fn(async (u) => {
    await gate(u).promise
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }
  })
})

afterEach(() => {
  for (const { release } of gates.values()) release()
  clearDecryptedMediaCache()
})

const settle = () => new Promise((r) => setTimeout(r, 0))

describe('the two decrypt lanes', () => {
  it('fills the six slots and queues the rest', async () => {
    for (let i = 0; i < 9; i++) prefetchDecryptedMedia(url(i), KEY, 'image/*')
    await settle()

    const { active, prefetch } = __queueDepths()
    expect(active).toBe(6)
    expect(prefetch).toBe(3)
  })

  it('puts a prefetch in the background lane, not the foreground one', async () => {
    for (let i = 0; i < 9; i++) prefetchDecryptedMedia(url(i), KEY, 'image/*')
    await settle()

    expect(__queueDepths().prefetch).toBe(3)
    expect(__queueDepths().foreground).toBe(0)
  })

  it('runs a waiting foreground job before any queued prefetch', async () => {
    // Saturate the slots, then queue three prefetches behind them.
    for (let i = 0; i < 9; i++) prefetchDecryptedMedia(url(i), KEY, 'image/*')
    await settle()

    // Now something on screen is wanted — this is the lightbox case.
    const wanted = url('wanted')
    wantOnScreen(wanted)
    await settle()

    expect(__queueDepths().foreground).toBe(1)

    // Free exactly one slot. The foreground job must take it.
    gate(url(0)).release()
    await settle()
    await settle()

    const fetched = globalThis.fetch.mock.calls.map(([u]) => u)
    expect(fetched).toContain(wanted)
    // And the prefetch backlog is still waiting.
    expect(__queueDepths().prefetch).toBe(3)
  })

  it('promotes an already-queued prefetch when it becomes wanted', async () => {
    // The case a lightbox hits after MomentViewer warms its neighbours: the job
    // exists, so no new one is queued and the promise is shared. Without
    // promotion it stays stuck behind the rest of the batch.
    for (let i = 0; i < 9; i++) prefetchDecryptedMedia(url(i), KEY, 'image/*')
    await settle()
    expect(__queueDepths().prefetch).toBe(3)

    // url(8) is last in the prefetch backlog.
    wantOnScreen(url(8))
    await settle()

    expect(__queueDepths().foreground).toBe(1)
    expect(__queueDepths().prefetch).toBe(2)

    gate(url(0)).release()
    await settle()
    await settle()

    // It jumped the two prefetches that were ahead of it.
    const fetched = globalThis.fetch.mock.calls.map(([u]) => u)
    expect(fetched).toContain(url(8))
    expect(fetched).not.toContain(url(6))
  })

  it('shares one in-flight job rather than fetching twice', async () => {
    const u = url('shared')
    const a = prefetchDecryptedMedia(u, KEY, 'image/*')
    const b = prefetchDecryptedMedia(u, KEY, 'image/*')
    await settle()

    expect(globalThis.fetch.mock.calls.filter(([f]) => f === u)).toHaveLength(1)
    gate(u).release()
    expect(await a).toBe(await b)
  })

  it('drains the prefetch lane once nothing is waiting on screen', async () => {
    for (let i = 0; i < 8; i++) prefetchDecryptedMedia(url(i), KEY, 'image/*')
    await settle()
    expect(__queueDepths().prefetch).toBe(2)

    for (const { release } of gates.values()) release()
    await settle()
    await settle()
    await settle()

    expect(__queueDepths().prefetch).toBe(0)
  })
})

/**
 * Ask for a photo the way something on screen does — by mounting the hook. No
 * test-only door into the scheduler: the foreground lane is reached through the
 * same public path the feed and the lightbox use.
 */
function wantOnScreen(u) {
  return renderHook(() => useDecryptedMedia(u, 'image/*'))
}
