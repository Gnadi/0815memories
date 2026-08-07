import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { loadSlotImages } from '../utils/collageRenderer'

const EMPTY = new Map()

/**
 * Decrypt and decode every photo a collage document references, ready to draw.
 *
 * The canvas renderer needs real <img> elements, not React components, so this
 * goes through `loadSlotImages` (which reuses the shared decrypted-media cache)
 * rather than mounting <EncryptedImage>.
 *
 * Results accumulate rather than replace: switching template or filling one more
 * slot must not blank the photos already on screen while the new set resolves.
 *
 * `preferThumbs` loads the small copies — right for gallery cards and the
 * template strip, wrong for the editor and exports.
 */
export function useCollageImages(doc, { preferThumbs = false } = {}) {
  const { encryptionKey } = useAuth()
  const [images, setImages] = useState(EMPTY)

  // Re-fetch only when the actual photo set changes; every keystroke in the
  // title field would otherwise re-decrypt the whole collage.
  const urlKey = useMemo(
    () => (doc?.slots || [])
      .map((s) => (preferThumbs && s.thumbUrl) || s.url || '')
      .filter(Boolean)
      .join('|'),
    [doc, preferThumbs]
  )

  useEffect(() => {
    if (!urlKey) return
    let cancelled = false
    const slots = urlKey.split('|').map((url) => ({ url }))
    loadSlotImages({ slots }, encryptionKey).then((map) => {
      if (cancelled || map.size === 0) return
      setImages((prev) => {
        const next = new Map(prev)
        for (const [key, img] of map) next.set(key, img)
        return next
      })
    })
    return () => { cancelled = true }
  }, [urlKey, encryptionKey])

  // The map is keyed by whichever URL was loaded; when thumbs were preferred
  // the caller's slots still carry the full-size URL, so re-key by slot.
  return useMemo(() => {
    if (!preferThumbs || images === EMPTY) return images
    const byOriginal = new Map()
    for (const slot of doc?.slots || []) {
      const loadedUrl = slot.thumbUrl || slot.url
      const img = loadedUrl ? images.get(loadedUrl) : null
      if (img && slot.url) byOriginal.set(slot.url, img)
    }
    return byOriginal
  }, [images, doc, preferThumbs])
}
