import { useRef } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import EncryptedImage from '../media/EncryptedImage'

/**
 * Persistent photo strip shown at the bottom of the scrapbook editor.
 * Mirrors the reference design: "Photos — Upload new or reuse from your memories".
 *
 * Props:
 *  - memoryPhotos: [{ id, url, memoryTitle }]
 *  - sessionPhotos: string[] (URLs uploaded during this session)
 *  - onUpload(file)
 *  - onPick(url) — called when a thumbnail is tapped
 *  - uploading: boolean
 *  - mode: 'idle' | 'fill' | 'replace' | 'swap'
 *    - idle   → tapping a thumbnail adds a new photo element
 *    - fill   → fill the currently-selected empty slot
 *    - replace→ replace the currently-selected photo's url
 *    - swap   → awaiting second pick to swap urls between two photos
 *  - hint: optional string describing mode (e.g. "Pick a photo to swap with")
 */
export default function PhotoBar({
  memoryPhotos = [],
  sessionPhotos = [],
  onUpload,
  onPick,
  uploading = false,
  mode = 'idle',
  hint,
}) {
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) onUpload?.(file)
    e.target.value = ''
  }

  const label = hint || (
    mode === 'fill' ? 'Tap a photo to fill the selected slot'
    : mode === 'replace' ? 'Tap a photo to replace'
    : mode === 'swap' ? 'Tap a photo to swap with'
    : 'Upload new or reuse from your memories'
  )

  return (
    <div className="bg-warm-white border-t border-cream-dark">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      <div className="px-4 pt-3 pb-1 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-bark">Photos</h3>
        <span className={`text-[11px] truncate ${mode === 'idle' ? 'text-bark-muted' : 'text-kaydo font-medium'}`}>
          {label}
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto hide-scrollbar px-4 pb-3">
        {/* Upload tile */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex-shrink-0 w-24 h-24 rounded-2xl border-2 border-dashed border-kaydo/60 bg-kaydo/5 hover:bg-kaydo/10 hover:border-kaydo text-kaydo transition-colors flex flex-col items-center justify-center gap-1 disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Upload className="w-5 h-5" />
          )}
          <span className="text-[11px] font-semibold">
            {uploading ? 'Uploading…' : 'Add photos'}
          </span>
        </button>

        {/* Session uploads (newest first) */}
        {sessionPhotos.map((url) => (
          <PhotoThumb key={`s:${url}`} url={url} onClick={() => onPick?.(url)} />
        ))}

        {/* Memory library */}
        {memoryPhotos.map((p) => (
          <PhotoThumb key={p.id} url={p.url} title={p.memoryTitle} onClick={() => onPick?.(p.url)} />
        ))}

        {memoryPhotos.length === 0 && sessionPhotos.length === 0 && !uploading && (
          <div className="flex items-center px-2 text-xs text-bark-muted italic">
            No photos yet — upload one to get started.
          </div>
        )}
      </div>
    </div>
  )
}

function PhotoThumb({ url, title, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title || undefined}
      className="flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden border border-cream-dark bg-cream-dark hover:border-kaydo hover:shadow-md transition-all active:scale-95"
    >
      <EncryptedImage
        src={url}
        alt={title || ''}
        className="w-full h-full object-cover"
      />
    </button>
  )
}
