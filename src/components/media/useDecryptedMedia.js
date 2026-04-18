import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { decryptBlob } from '../../utils/encryption'
import { devError } from '../../utils/devLog'

// Session-level cache: encrypted URL -> decrypted object URL
const cache = new Map()
// Dedupe concurrent fetches: encrypted URL -> Promise<object URL>
const inflight = new Map()

export default function useDecryptedMedia(encryptedUrl, mimeType = 'application/octet-stream') {
  const { encryptionKey } = useAuth()
  const [decryptedUrl, setDecryptedUrl] = useState(null)
  const [loading, setLoading] = useState(!!encryptedUrl)
  const [error, setError] = useState(null)
  const objectUrlRef = useRef(null)

  useEffect(() => {
    if (!encryptedUrl) {
      setDecryptedUrl(null)
      setLoading(false)
      return
    }

    // No encryption key means data is not encrypted (or key not yet loaded)
    if (!encryptionKey) {
      setDecryptedUrl(encryptedUrl)
      setLoading(false)
      return
    }

    // Check cache first
    if (cache.has(encryptedUrl)) {
      setDecryptedUrl(cache.get(encryptedUrl))
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    async function fetchAndDecrypt() {
      try {
        let promise = inflight.get(encryptedUrl)
        if (!promise) {
          promise = (async () => {
            const response = await fetch(encryptedUrl)
            if (!response.ok) throw new Error(`Fetch failed (${response.status})`)
            const encryptedBuffer = await response.arrayBuffer()
            const decryptedBlob = await decryptBlob(encryptionKey, encryptedBuffer, mimeType)
            const url = URL.createObjectURL(decryptedBlob)
            cache.set(encryptedUrl, url)
            return url
          })()
          inflight.set(encryptedUrl, promise)
          promise.finally(() => inflight.delete(encryptedUrl))
        }

        const url = await promise

        if (cancelled) return

        objectUrlRef.current = url
        setDecryptedUrl(url)
      } catch (err) {
        if (cancelled) return
        devError('Media decryption failed:', err)
        // Fallback: use the URL as-is (might be unencrypted)
        setDecryptedUrl(encryptedUrl)
        setError(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAndDecrypt()

    return () => {
      cancelled = true
    }
  }, [encryptedUrl, encryptionKey, mimeType])

  return { decryptedUrl, loading, error }
}
