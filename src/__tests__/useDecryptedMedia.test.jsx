import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, render, act, waitFor } from '@testing-library/react'

// Isolate the hook from Web Crypto and the network.
vi.mock('../utils/encryption', () => ({
  decryptBlob: vi.fn(),
}))
vi.mock('../utils/devLog', () => ({
  devError: vi.fn(),
  devWarn: vi.fn(),
}))

// Auth state is driven per-test rather than by mounting a real AuthProvider,
// which would pull in Firebase.
let authState = { encryptionKey: null, keyLoading: false }
vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}))

import { decryptBlob } from '../utils/encryption'
import useDecryptedMedia, {
  clearDecryptedMediaCache,
  prefetchDecryptedMedia,
} from '../components/media/useDecryptedMedia'
import EncryptedImage from '../components/media/EncryptedImage'

const ENCRYPTED_URL = 'https://res.cloudinary.com/demo/raw/upload/kaydo/encrypted/a.dat'
const FAKE_KEY = { fake: 'key' }

let objectUrlCounter = 0

// A JPEG magic-byte header so the MIME sniffer has something real to read.
function jpegBlob() {
  return new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])], {
    type: 'image/*',
  })
}

beforeEach(() => {
  clearDecryptedMediaCache()
  authState = { encryptionKey: null, keyLoading: false }
  objectUrlCounter = 0

  URL.createObjectURL = vi.fn(() => `blob:decrypted-${++objectUrlCounter}`)
  URL.revokeObjectURL = vi.fn()

  decryptBlob.mockReset()
  decryptBlob.mockResolvedValue(jpegBlob())

  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(32),
  }))

  // jsdom has no IntersectionObserver; treat every observed element as visible
  // so the lazy gate does not swallow the tests.
  globalThis.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback
    }
    observe(node) {
      this.callback([{ isIntersecting: true, target: node }])
    }
    disconnect() {}
    unobserve() {}
  }
})

afterEach(() => {
  clearDecryptedMediaCache()
})

describe('useDecryptedMedia', () => {
  it('never exposes the ciphertext URL while the key is still loading', async () => {
    authState = { encryptionKey: null, keyLoading: true }
    const { result } = renderHook(() => useDecryptedMedia(ENCRYPTED_URL, 'image/*'))

    expect(result.current.decryptedUrl).toBeNull()
    expect(result.current.loading).toBe(true)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('passes an unencrypted URL straight through once the key is known to be absent', () => {
    authState = { encryptionKey: null, keyLoading: false }
    const { result } = renderHook(() => useDecryptedMedia(ENCRYPTED_URL, 'image/*'))

    expect(result.current.decryptedUrl).toBe(ENCRYPTED_URL)
    expect(result.current.loading).toBe(false)
  })

  it('fetches and decrypts once, then serves later mounts from cache on the first render', async () => {
    authState = { encryptionKey: FAKE_KEY, keyLoading: false }

    const first = renderHook(() => useDecryptedMedia(ENCRYPTED_URL, 'image/*'))
    expect(first.result.current.loading).toBe(true)

    await waitFor(() => expect(first.result.current.decryptedUrl).toBe('blob:decrypted-1'))
    first.unmount()

    // The whole point of the fix: a second mount must resolve during render,
    // with no intermediate loading frame that would repaint a placeholder.
    const renders = []
    renderHook(() => {
      const state = useDecryptedMedia(ENCRYPTED_URL, 'image/*')
      renders.push({ url: state.decryptedUrl, loading: state.loading })
      return state
    })

    expect(renders[0]).toEqual({ url: 'blob:decrypted-1', loading: false })
    expect(renders.every((r) => r.loading === false)).toBe(true)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('dedupes concurrent mounts of the same URL into one fetch', async () => {
    authState = { encryptionKey: FAKE_KEY, keyLoading: false }

    const a = renderHook(() => useDecryptedMedia(ENCRYPTED_URL, 'image/*'))
    const b = renderHook(() => useDecryptedMedia(ENCRYPTED_URL, 'image/*'))

    await waitFor(() => {
      expect(a.result.current.decryptedUrl).toBe('blob:decrypted-1')
      expect(b.result.current.decryptedUrl).toBe('blob:decrypted-1')
    })
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('re-types the blob from its magic bytes instead of the "image/*" hint', async () => {
    authState = { encryptionKey: FAKE_KEY, keyLoading: false }
    const { result } = renderHook(() => useDecryptedMedia(ENCRYPTED_URL, 'image/*'))

    await waitFor(() => expect(result.current.decryptedUrl).toBeTruthy())
    const blob = URL.createObjectURL.mock.calls[0][0]
    expect(blob.type).toBe('image/jpeg')
  })

  it('passes blob: previews through without touching the network', () => {
    authState = { encryptionKey: FAKE_KEY, keyLoading: false }
    const { result } = renderHook(() => useDecryptedMedia('blob:local-preview', 'image/*'))

    expect(result.current.decryptedUrl).toBe('blob:local-preview')
    expect(result.current.loading).toBe(false)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('resolves a cached URL synchronously when the src prop changes', async () => {
    authState = { encryptionKey: FAKE_KEY, keyLoading: false }
    const other = 'https://res.cloudinary.com/demo/raw/upload/kaydo/encrypted/b.dat'

    const { result, rerender } = renderHook(({ url }) => useDecryptedMedia(url, 'image/*'), {
      initialProps: { url: ENCRYPTED_URL },
    })
    await waitFor(() => expect(result.current.decryptedUrl).toBe('blob:decrypted-1'))

    rerender({ url: other })
    await waitFor(() => expect(result.current.decryptedUrl).toBe('blob:decrypted-2'))

    // Sliding back to a neighbour that is already decrypted must not flash.
    rerender({ url: ENCRYPTED_URL })
    expect(result.current.decryptedUrl).toBe('blob:decrypted-1')
    expect(result.current.loading).toBe(false)
  })

  it('does not revoke an object URL that a mounted component still displays', async () => {
    authState = { encryptionKey: FAKE_KEY, keyLoading: false }
    const { result } = renderHook(() => useDecryptedMedia(ENCRYPTED_URL, 'image/*'))
    await waitFor(() => expect(result.current.decryptedUrl).toBe('blob:decrypted-1'))

    // clearDecryptedMediaCache is the deliberate teardown (logout); LRU eviction
    // is what must respect the refcount. Nothing has evicted here, so no revoke.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  })

  it('releases every object URL on logout', async () => {
    authState = { encryptionKey: FAKE_KEY, keyLoading: false }
    const { result, unmount } = renderHook(() => useDecryptedMedia(ENCRYPTED_URL, 'image/*'))
    await waitFor(() => expect(result.current.decryptedUrl).toBe('blob:decrypted-1'))
    unmount()

    act(() => clearDecryptedMediaCache())
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:decrypted-1')
  })
})

describe('EncryptedImage', () => {
  it('keeps one <img> mounted across the loading transition', async () => {
    authState = { encryptionKey: FAKE_KEY, keyLoading: false }
    const { container } = render(<EncryptedImage src={ENCRYPTED_URL} alt="A photo" className="rounded-xl" />)

    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img.className).toContain('rounded-xl')
    expect(img.className).toContain('media-decrypting')

    await waitFor(() => expect(container.querySelector('img').className).not.toContain('media-decrypting'))
    // Same node, so the browser never tore down and re-decoded the element.
    expect(container.querySelector('img')).toBe(img)
    expect(img.getAttribute('src')).toBe('blob:decrypted-1')
    expect(img.getAttribute('alt')).toBe('A photo')
  })

  it('never points the element at ciphertext while the key loads', () => {
    authState = { encryptionKey: null, keyLoading: true }
    const { container } = render(<EncryptedImage src={ENCRYPTED_URL} alt="A photo" />)

    const img = container.querySelector('img')
    expect(img.getAttribute('src')).not.toBe(ENCRYPTED_URL)
    expect(img.getAttribute('src').startsWith('data:image/gif')).toBe(true)
  })

  it('shows the decrypting placeholder for as long as the key is still loading', () => {
    authState = { encryptionKey: null, keyLoading: true }
    const { container } = render(<EncryptedImage src={ENCRYPTED_URL} alt="A photo" />)

    expect(container.querySelector('img').className).toContain('media-decrypting')
  })

  it('adopts a photo that was cached while it was still off-screen', async () => {
    // The home page renders the same photos twice: once in the feed, once in
    // AlbumGlimpse below the fold. The second copy mounts on a cache miss, so
    // nothing resolves it during render — and by the time it scrolls into view
    // the first copy has filled the cache. Becoming visible has to pick that up.
    authState = { encryptionKey: FAKE_KEY, keyLoading: false }

    // An observer that reports intersection only when this test says so.
    let intersect = null
    globalThis.IntersectionObserver = class {
      constructor(callback) {
        this.callback = callback
      }
      observe(node) {
        intersect = () => act(() => this.callback([{ isIntersecting: true, target: node }]))
      }
      disconnect() {}
      unobserve() {}
    }

    const { container } = render(<EncryptedImage src={ENCRYPTED_URL} alt="A photo" />)
    expect(container.querySelector('img').className).toContain('media-decrypting')
    expect(globalThis.fetch).not.toHaveBeenCalled()

    // Somebody else decrypts the same photo while this one is still off-screen.
    await act(() => prefetchDecryptedMedia(ENCRYPTED_URL, FAKE_KEY, 'image/*'))

    intersect()

    await waitFor(() =>
      expect(container.querySelector('img').getAttribute('src')).toBe('blob:decrypted-1')
    )
    expect(container.querySelector('img').className).not.toContain('media-decrypting')
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('carries no placeholder when the media resolves during render', async () => {
    authState = { encryptionKey: FAKE_KEY, keyLoading: false }
    const warm = render(<EncryptedImage src={ENCRYPTED_URL} alt="A photo" />)
    await waitFor(() =>
      expect(warm.container.querySelector('img').getAttribute('src')).toBe('blob:decrypted-1')
    )
    warm.unmount()

    // A cache hit must never paint the spinner, not even for one frame.
    const { container } = render(<EncryptedImage src={ENCRYPTED_URL} alt="A photo" />)
    expect(container.querySelector('img').className).not.toContain('media-decrypting')
  })
})
