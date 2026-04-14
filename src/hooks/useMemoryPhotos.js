import { useMemo } from 'react'
import { useMemories } from './useMemories'

/**
 * Returns a flat, de-duplicated list of every photo URL found across all
 * family memories. Each entry includes the memory id + title for context.
 *
 * Shape: [{ id: `${memoryId}:${index}`, url, memoryId, memoryTitle }]
 */
export function useMemoryPhotos(familyId, encryptionKey) {
  const { memories, loading } = useMemories(familyId, encryptionKey)

  const photos = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const m of memories) {
      const urls = Array.isArray(m.images) && m.images.length > 0
        ? m.images
        : (m.imageUrl ? [m.imageUrl] : [])
      urls.forEach((url, i) => {
        if (!url || seen.has(url)) return
        seen.add(url)
        out.push({
          id: `${m.id}:${i}`,
          url,
          memoryId: m.id,
          memoryTitle: m.title || '',
        })
      })
    }
    return out
  }, [memories])

  return { photos, loading }
}
