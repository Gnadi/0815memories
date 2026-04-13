import { useMemo, useRef, useState } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useMemories, useAllMoments } from '../../hooks/useMemories'
import { encryptAndUpload } from '../../utils/encryptedUpload'
import EncryptedImage from '../media/EncryptedImage'

// Horizontal strip of recent photos from the family's memories + moments.
// Tapping a thumbnail adds the photo to the scrapbook — either filling the
// currently-selected empty slot or adding a free-floating photo. The leading
// "Add photos" button uploads a brand-new image through the same pipeline.
export default function MemoryPhotoStrip({ onPhotoClick }) {
  const { familyId, encryptionKey } = useAuth()
  const { moments } = useAllMoments(familyId)
  const { memories } = useMemories(familyId, encryptionKey)
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)

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

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const { url } = await encryptAndUpload(file, encryptionKey)
      onPhotoClick?.(url)
    } catch (err) {
      console.error('Upload failed', err)
      alert('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="w-full mt-4 bg-warm-white border border-cream-dark rounded-xl p-3">
      <div className="flex items-baseline justify-between mb-2 px-1">
        <p className="text-xs font-semibold text-bark">Photos</p>
        <p className="text-[10px] text-bark-muted">
          Upload new or reuse from your memories
        </p>
      </div>
      <div className="flex gap-2 items-center overflow-x-auto hide-scrollbar pb-1">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex-shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-kaydo bg-kaydo/10 text-kaydo flex flex-col items-center justify-center gap-1 hover:bg-kaydo/20 transition-colors active:scale-95 disabled:opacity-60"
          title="Upload a new photo"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Upload className="w-5 h-5" />
          )}
          <span className="text-[10px] font-semibold leading-tight text-center px-1">
            {uploading ? 'Uploading…' : 'Add photos'}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
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
