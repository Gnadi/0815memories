import { useState } from 'react'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { EMOTIONS } from '../../constants/emotions'
import EncryptedImage from '../media/EncryptedImage'

export default function JournalEntryCard({ entry, onEdit, onDelete, onView }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const emotion = EMOTIONS.find((e) => e.key === entry.emotion) || EMOTIONS[1]
  const date = entry.date?.toDate ? entry.date.toDate() : new Date(entry.date)
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div onClick={onView} className="bg-warm-white rounded-2xl shadow-sm border border-cream-dark overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
      {/* Photo strip */}
      {entry.photos?.length > 0 && (
        <div className="flex gap-1 h-36 overflow-hidden">
          {entry.photos.slice(0, 3).map((url, i) => (
            <EncryptedImage
              key={i}
              src={url}
              alt=""
              className="flex-1 object-cover min-w-0"
            />
          ))}
        </div>
      )}

      <div className="p-5">
        {/* Date + emotion */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-bark-muted">{formattedDate}</p>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${emotion.bg} ${emotion.text}`}>
              {emotion.emoji} {emotion.label}
            </span>
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
                className="text-bark-muted hover:text-bark p-1 rounded-lg"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-7 bg-white rounded-xl shadow-lg border border-cream-dark z-10 min-w-[130px] py-1">
                  <button
                    onClick={() => { setMenuOpen(false); onEdit() }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-bark hover:bg-cream"
                  >
                    <Pencil className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); onDelete() }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Volume */}
        {entry.volume && (
          <p className="text-xs font-semibold text-hearth uppercase tracking-wide mb-1">{entry.volume}</p>
        )}

        {/* Title */}
        {entry.title && (
          <h3 className="text-lg font-bold text-bark mb-2">{entry.title}</h3>
        )}

        {/* Content preview */}
        <p className="text-sm text-bark-muted leading-relaxed line-clamp-4 whitespace-pre-wrap">
          {entry.content}
        </p>

        {/* Voice memo indicator */}
        {entry.voiceMemos?.length > 0 && (
          <p className="text-xs text-bark-muted mt-3">
            🎙 {entry.voiceMemos.length} voice {entry.voiceMemos.length === 1 ? 'memo' : 'memos'}
          </p>
        )}

        {/* Video indicator */}
        {entry.videos?.length > 0 && (
          <p className="text-xs text-bark-muted mt-1">
            🎬 {entry.videos.length} {entry.videos.length === 1 ? 'video' : 'videos'}
          </p>
        )}
      </div>
    </div>
  )
}
