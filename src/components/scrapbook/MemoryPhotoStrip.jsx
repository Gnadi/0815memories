import { useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useMemories, useAllMoments } from '../../hooks/useMemories'
import EncryptedImage from '../media/EncryptedImage'

// Horizontal strip of recent photos from the family's memories + moments.
// Tapping a thumbnail adds the photo to the scrapbook — either filling the
// currently-selected empty slot or adding a free-floating photo.
export default function MemoryPhotoStrip({ onPhotoClick }) {
  const { familyId, encryptionKey } = useAuth()
  const { moments } = useAllMoments(familyId)
  const { memories } = useMemories(familyId, encryptionKey)

  const photos = useMemo(() => {
    const all = []
    for (const mom of moments || []) {
      for (const url of mom.images || []) {
        if (url) all.push({ url, ts: mom.date?.toMillis?.() ?? 0, key: `mom-${mom.id}-${url}` })
      }
    }
    for (const mem of memories || []) {
      const imgs = mem.images || (mem.imageUrl ? [mem.imageUrl] : [])
      for (const url of imgs) {
        if (url) all.push({ url, ts: mem.date?.toMillis?.() ?? 0, key: `mem-${mem.id}-${url}` })
      }
    }
    // De-dup by URL (memories and moments sometimes share) and sort newest first.
    const seen = new Set()
    const unique = []
    for (const p of all.sort((a, b) => b.ts - a.ts)) {
      if (seen.has(p.url)) continue
      seen.add(p.url)
      unique.push(p)
    }
    return unique.slice(0, 40)
  }, [moments, memories])

  if (photos.length === 0) return null

  return (
    <div className="w-full mt-4 bg-warm-white border border-cream-dark rounded-xl p-3">
      <div className="flex items-baseline justify-between mb-2 px-1">
        <p className="text-xs font-semibold text-bark">Photos from your memories</p>
        <p className="text-[10px] text-bark-muted">
          Tap to add to the active page
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
        {photos.map((p) => (
          <button
            key={p.key}
            onClick={() => onPhotoClick?.(p.url)}
            className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 border-cream-dark hover:border-kaydo transition-colors active:scale-95"
            title="Add to scrapbook"
          >
            <EncryptedImage
              src={p.url}
              alt=""
              className="w-full h-full object-cover"
              draggable={false}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
