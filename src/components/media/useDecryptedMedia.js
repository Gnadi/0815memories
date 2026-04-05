import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { decryptBlob } from '../../utils/encryption'

// Session-level cache: encrypted URL -> decrypted object URL
const cache = new Map()

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
        const response = await fetch(encryptedUrl)
        if (!response.ok) throw new Error(`Fetch failed (${response.status})`)

        const encryptedBuffer = await response.arrayBuffer()
        const decryptedBlob = await decryptBlob(encryptionKey, encryptedBuffer, mimeType)

        if (cancelled) return

        const url = URL.createObjectURL(decryptedBlob)
        objectUrlRef.current = url
        cache.set(encryptedUrl, url)
        setDecryptedUrl(url)
      } catch (err) {
        if (cancelled) return
        console.error('Media decryption failed:', err)
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
