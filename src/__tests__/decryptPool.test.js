import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../utils/encryption', () => ({ decryptBlob: vi.fn() }))
vi.mock('../utils/devLog', () => ({ devError: vi.fn(), devWarn: vi.fn() }))

import { decryptBlob } from '../utils/encryption'
import { decryptBlobOffThread, terminateDecryptPool } from '../utils/decryptPool'

beforeEach(() => {
  terminateDecryptPool()
  decryptBlob.mockReset()
  decryptBlob.mockResolvedValue(new Blob(['plaintext'], { type: 'image/jpeg' }))
})

afterEach(() => {
  terminateDecryptPool()
  delete globalThis.Worker
})

describe('decryptBlobOffThread', () => {
  it('decrypts on the main thread when Worker is unavailable', async () => {
    // jsdom has no Worker; neither does the Node pre-render. The fallback is
    // the code path that existed before the pool, so behaviour is unchanged.
    expect(typeof Worker).toBe('undefined')

    const key = { fake: 'key' }
    const buffer = new ArrayBuffer(32)
    const blob = await decryptBlobOffThread(key, buffer, 'image/jpeg')

    expect(decryptBlob).toHaveBeenCalledWith(key, buffer, 'image/jpeg')
    expect(await blob.text()).toBe('plaintext')
  })

  it('falls back to the main thread when constructing a worker throws', async () => {
    globalThis.Worker = class {
      constructor() { throw new Error('blocked by CSP') }
    }

    const blob = await decryptBlobOffThread({ fake: 'key' }, new ArrayBuffer(8), 'image/jpeg')

    expect(decryptBlob).toHaveBeenCalled()
    expect(await blob.text()).toBe('plaintext')
  })

  it('uses a worker when one is available, and hands it the key just once', async () => {
    const posted = []
    globalThis.Worker = class {
      constructor() {
        this.onmessage = null
        this.onerror = null
      }
      postMessage(message) {
        posted.push(message)
        if (message.type !== 'decrypt') return
        // Echo back a plaintext buffer the way the real worker would.
        queueMicrotask(() =>
          this.onmessage({ data: { id: message.id, plaintext: new TextEncoder().encode('from worker').buffer } })
        )
      }
      terminate() {}
    }

    const key = { fake: 'key' }
    const first = await decryptBlobOffThread(key, new ArrayBuffer(8), 'image/jpeg')
    const second = await decryptBlobOffThread(key, new ArrayBuffer(8), 'image/jpeg')

    expect(await first.text()).toBe('from worker')
    expect(first.type).toBe('image/jpeg')
    expect(await second.text()).toBe('from worker')
    expect(decryptBlob).not.toHaveBeenCalled()

    // The key goes to each worker once and then stays there: the count is a
    // function of the pool size, not of how many images have been decrypted.
    const keyMessagesAfterTwo = posted.filter((m) => m.type === 'key').length
    expect(keyMessagesAfterTwo).toBeGreaterThan(0)
    expect(posted.filter((m) => m.type === 'key').every((m) => m.key === key)).toBe(true)

    await decryptBlobOffThread(key, new ArrayBuffer(8), 'image/jpeg')
    expect(posted.filter((m) => m.type === 'key').length).toBe(keyMessagesAfterTwo)
  })

  it('surfaces a worker-side decryption failure instead of silently succeeding', async () => {
    globalThis.Worker = class {
      constructor() { this.onmessage = null }
      postMessage(message) {
        if (message.type !== 'decrypt') return
        queueMicrotask(() => this.onmessage({ data: { id: message.id, error: 'bad key' } }))
      }
      terminate() {}
    }

    await expect(
      decryptBlobOffThread({ fake: 'key' }, new ArrayBuffer(8), 'image/jpeg')
    ).rejects.toThrow('bad key')
  })
})
