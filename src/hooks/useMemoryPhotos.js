import { useMemo } from 'react'
import { useMemories } from './useMemories'
import { thumbAt } from '../utils/mediaThumbs'

/**
 * Returns a flat, de-duplicated list of every photo URL found across all
 * family memories. Each entry includes the memory id + title for context, the
 * memory's date (so callers can group by year or season) and the downscaled
 * copy when one exists — pickers and reels show these small.
 *
 * Shape: [{ id: `${memoryId}:${index}`, url, thumbUrl, memoryId, memoryTitle, date }]
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
          thumbUrl: thumbAt(m, i) || '',
          memoryId: m.id,
          memoryTitle: m.title || '',
          date: m.date?.toDate?.() || (m.date instanceof Date ? m.date : null),
        })
      })
    }
    return out
  }, [memories])

  return { photos, loading }
}
