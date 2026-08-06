import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { decryptBlobOffThread } from '../../utils/decryptPool'
import { devError } from '../../utils/devLog'

// ── Session cache ───────────────────────────────────────────────────
// encryptedUrl -> { objectUrl, size, refs }
// Insertion order doubles as the LRU order: a cache hit re-inserts the entry
// at the tail, so eviction always starts from the least recently used head.
const cache = new Map()
// Dedupe concurrent fetches: encrypted URL -> Promise<object URL>
const inflight = new Map()

let cachedBytes = 0
// Decrypted originals are large. Without a ceiling a long scroll pins every
// full-resolution photo in memory for the whole session, which on mobile ends
// in a tab discard — the page reloads and every image flashes back in.
const MAX_CACHE_BYTES = 150 * 1024 * 1024

// Only entries nothing is displaying may be revoked. Revoking an object URL
// out from under a mounted <img> blanks it — exactly the flicker we're fixing.
function evict() {
  if (cachedBytes <= MAX_CACHE_BYTES) return
  for (const [key, entry] of cache) {
    if (cachedBytes <= MAX_CACHE_BYTES) break
    if (entry.refs > 0) continue
    cache.delete(key)
    cachedBytes -= entry.size
    URL.revokeObjectURL(entry.objectUrl)
  }
}

function storeInCache(encryptedUrl, objectUrl, size) {
  cache.set(encryptedUrl, { objectUrl, size, refs: 0 })
  cachedBytes += size
  evict()
}

// Drop every decrypted blob. Called on logout — without it, plaintext object
// URLs from the previous session stay resolvable for as long as the tab lives.
export function clearDecryptedMediaCache() {
  for (const entry of cache.values()) URL.revokeObjectURL(entry.objectUrl)
  cache.clear()
  inflight.clear()
  cachedBytes = 0
}

// ── Decrypt scheduling ──────────────────────────────────────────────
// A feed mounts dozens of media components at once. Firing every fetch +
// main-thread AES-GCM decrypt simultaneously starves the ones the user is
// actually looking at, so images trickle in over several seconds.
const MAX_CONCURRENT_DECRYPTS = 6
let activeDecrypts = 0
const pending = []

function pump() {
  while (activeDecrypts < MAX_CONCURRENT_DECRYPTS && pending.length > 0) {
    const job = pending.shift()
    activeDecrypts++
    job
      .run()
      .then(job.resolve, job.reject)
      .finally(() => {
        activeDecrypts--
        pump()
      })
  }
}

function schedule(run) {
  return new Promise((resolve, reject) => {
    pending.push({ run, resolve, reject })
    pump()
  })
}

// ── MIME sniffing ───────────────────────────────────────────────────
// Callers pass a category hint like 'image/*', which is not a real MIME type
// and leaves the browser to content-sniff the blob. Reading the magic bytes of
// the plaintext is cheap and gives the blob an honest type.
function sniffMimeType(header) {
  const b = header
  if (b.length < 4) return null
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif'
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm'
  // RIFF....WEBP
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b.length >= 12) {
    if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'
  }
  // ....ftyp<brand>
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11])
    if (brand === 'avif' || brand === 'avis') return 'image/avif'
    if (brand.startsWith('hei') || brand.startsWith('mif')) return 'image/heic'
    return 'video/mp4'
  }
  if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return 'audio/ogg'
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return 'audio/mpeg'
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return 'audio/mpeg'
  return null
}

async function decryptToObjectUrl(encryptedUrl, encryptionKey, mimeType) {
  const response = await fetch(encryptedUrl)
  if (!response.ok) throw new Error(`Fetch failed (${response.status})`)
  const encryptedBuffer = await response.arrayBuffer()
  // Runs in a worker when one is available; falls back to the main thread
  // otherwise. The buffer is transferred, so it must not be touched after this.
  const decrypted = await decryptBlobOffThread(encryptionKey, encryptedBuffer, mimeType)

  // Blob.slice() is by reference, so re-typing the blob costs no extra copy.
  const header = new Uint8Array(await decrypted.slice(0, 16).arrayBuffer())
  const sniffed = sniffMimeType(header)
  const blob = sniffed && sniffed !== decrypted.type
    ? new Blob([decrypted], { type: sniffed })
    : decrypted

  const url = URL.createObjectURL(blob)
  storeInCache(encryptedUrl, url, blob.size)
  return url
}

function loadDecrypted(encryptedUrl, encryptionKey, mimeType) {
  const hit = cache.get(encryptedUrl)
  if (hit) return Promise.resolve(hit.objectUrl)

  let promise = inflight.get(encryptedUrl)
  if (!promise) {
    promise = schedule(() => decryptToObjectUrl(encryptedUrl, encryptionKey, mimeType))
    inflight.set(encryptedUrl, promise)
    promise.finally(() => inflight.delete(encryptedUrl))
  }
  return promise
}

// Fetch + decrypt an encrypted URL into the shared cache without React state.
// Used to warm the cache for adjacent media so navigation feels instant.
// Returns a Promise resolving to the object URL (or null when not applicable).
export function prefetchDecryptedMedia(encryptedUrl, encryptionKey, mimeType = 'application/octet-stream') {
  if (!encryptedUrl || !encryptionKey) return Promise.resolve(null)
  if (isDirectUrl(encryptedUrl)) return Promise.resolve(encryptedUrl)
  const hit = cache.get(encryptedUrl)
  if (hit) return Promise.resolve(hit.objectUrl)
  // Swallow rejections here; the on-screen hook surfaces real errors.
  return loadDecrypted(encryptedUrl, encryptionKey, mimeType).catch(() => null)
}

// Local previews and inline data need no round trip through the decrypt path.
function isDirectUrl(url) {
  return url.startsWith('blob:') || url.startsWith('data:')
}

/**
 * Resolve what can be shown *during render*, with no effect and no repaint.
 *
 * This is what keeps cached media from flashing a skeleton: the lookup used to
 * live inside useEffect, which React runs after the browser has already painted
 * the loading state, so every mount cost one grey frame even when the decrypted
 * blob was sitting in memory.
 *
 * Returns null when the media genuinely has to be fetched first.
 */
function resolveImmediate(encryptedUrl, encryptionKey, keyLoading) {
  if (!encryptedUrl) return null
  if (isDirectUrl(encryptedUrl)) return encryptedUrl
  const hit = cache.get(encryptedUrl)
  if (hit) return hit.objectUrl
  // No key and none on the way means the asset predates encryption. While the
  // key is still loading we must NOT fall back to the raw URL — the browser
  // would try to decode ciphertext and paint a broken image.
  if (!encryptionKey && !keyLoading) return encryptedUrl
  return null
}

/**
 * @param {string} encryptedUrl
 * @param {string} mimeType  category hint, refined by magic-byte sniffing
 * @param {{ lazy?: boolean }} [options]
 *   lazy — defer fetch + decrypt until the element nears the viewport. Only for
 *   media that always has layout (images). Audio/video elements are often
 *   zero-sized behind custom controls and would never intersect.
 * @returns {{ decryptedUrl: string|null, loading: boolean, error: Error|null, ref: Function }}
 */
export default function useDecryptedMedia(encryptedUrl, mimeType = 'application/octet-stream', options = {}) {
  const { lazy = false } = options
  const { encryptionKey, keyLoading } = useAuth()

  const [decryptedUrl, setDecryptedUrl] = useState(() =>
    resolveImmediate(encryptedUrl, encryptionKey, keyLoading)
  )
  const [error, setError] = useState(null)
  // Gate starts open when nothing has to be fetched, so an already-decrypted or
  // direct URL never waits on an IntersectionObserver callback.
  const [visible, setVisible] = useState(() => !lazy || !!resolveImmediate(encryptedUrl, encryptionKey, keyLoading))

  // Re-resolve synchronously when the inputs change (slider navigation, key
  // arrival) instead of waiting for an effect — same reasoning as on mount.
  const [prevInputs, setPrevInputs] = useState({ encryptedUrl, encryptionKey, keyLoading })
  if (
    prevInputs.encryptedUrl !== encryptedUrl ||
    prevInputs.encryptionKey !== encryptionKey ||
    prevInputs.keyLoading !== keyLoading
  ) {
    setPrevInputs({ encryptedUrl, encryptionKey, keyLoading })
    const resolved = resolveImmediate(encryptedUrl, encryptionKey, keyLoading)
    setDecryptedUrl(resolved)
    setError(null)
    if (resolved) setVisible(true)
  }

  const elementRef = useRef(null)
  const observerRef = useRef(null)

  // Keep the displayed entry pinned so eviction can never revoke it.
  const retainedRef = useRef(null)
  useEffect(() => {
    const held = decryptedUrl && !isDirectUrl(decryptedUrl) ? encryptedUrl : null
    if (retainedRef.current === held) return

    const previous = retainedRef.current
    if (previous) {
      const entry = cache.get(previous)
      if (entry) entry.refs = Math.max(0, entry.refs - 1)
    }
    retainedRef.current = null

    if (held) {
      const entry = cache.get(held)
      if (entry) {
        entry.refs++
        retainedRef.current = held
        // Refresh the LRU position of something actively on screen.
        cache.delete(held)
        cache.set(held, entry)
      }
    }
  }, [decryptedUrl, encryptedUrl])

  useEffect(() => () => {
    const held = retainedRef.current
    if (!held) return
    const entry = cache.get(held)
    if (entry) entry.refs = Math.max(0, entry.refs - 1)
    retainedRef.current = null
  }, [])

  const ref = useCallback((node) => {
    elementRef.current = node
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
    if (!node || !lazy) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
          observerRef.current = null
        }
      },
      { rootMargin: '400px' }
    )
    observer.observe(node)
    observerRef.current = observer
  }, [lazy])

  useEffect(() => () => observerRef.current?.disconnect(), [])

  useEffect(() => {
    // Everything resolvable without a network round trip is already in state.
    if (!encryptedUrl || isDirectUrl(encryptedUrl)) return
    if (cache.has(encryptedUrl)) return
    if (!encryptionKey) return
    if (!visible) return

    let cancelled = false

    loadDecrypted(encryptedUrl, encryptionKey, mimeType)
      .then((url) => {
        if (cancelled) return
        setDecryptedUrl(url)
      })
      .catch((err) => {
        if (cancelled) return
        devError('Media decryption failed:', err)
        // Fallback: use the URL as-is (might be unencrypted)
        setDecryptedUrl(encryptedUrl)
        setError(err)
      })

    return () => {
      cancelled = true
    }
  }, [encryptedUrl, encryptionKey, mimeType, visible])

  return { decryptedUrl, loading: !!encryptedUrl && !decryptedUrl, error, ref }
}
