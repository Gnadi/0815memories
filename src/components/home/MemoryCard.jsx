import { useNavigate } from 'react-router-dom'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { formatDate } from '../../utils/helpers'
import { useAuth } from '../../context/AuthContext'

export default function MemoryCard({ memory, onEdit, onDelete }) {
  const [showMenu, setShowMenu] = useState(false)
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  return (
    <div
      className="bg-warm-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => navigate(`/memory/${memory.id}`)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-sm text-hearth font-medium">
          {formatDate(memory.date)}
        </span>
        {isAdmin && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(!showMenu)
              }}
              className="text-bark-muted hover:text-bark p-1"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-8 bg-white rounded-xl shadow-lg py-2 z-10 min-w-[140px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMenu(false)
                    onEdit?.(memory)
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-bark hover:bg-cream-dark"
                >
                  <Pencil className="w-4 h-4" /> Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMenu(false)
                    onDelete?.(memory.id)
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {memory.content && (
        <p className="px-4 pb-3 text-sm text-bark-light italic line-clamp-3">
          &ldquo;{memory.content}&rdquo;
        </p>
      )}

      {/* Image */}
      {memory.imageUrl ? (
        <img
          src={memory.imageUrl}
          alt={memory.title}
          className="w-full h-48 object-cover"
        />
      ) : (
        <MemoryPlaceholderImage title={memory.title} />
      )}

      {/* Caption */}
      {memory.quote && (
        <p className="px-4 py-3 text-xs text-bark-muted italic text-center">
          {memory.quote}
        </p>
      )}
    </div>
  )
}

function MemoryPlaceholderImage({ title }) {
  const hue = title ? title.charCodeAt(0) * 5 % 360 : 30
  return (
    <div
      className="w-full h-48 flex items-center justify-center"
      style={{ background: `hsl(${hue}, 30%, 85%)` }}
    >
      <svg viewBox="0 0 100 100" className="w-16 h-16 opacity-40">
        <rect x="10" y="20" width="80" height="60" rx="4" fill="currentColor" />
        <circle cx="35" cy="42" r="8" fill="white" opacity="0.5" />
        <path d="M10,70 L35,50 L55,65 L70,45 L90,70 L90,80 L10,80Z" fill="white" opacity="0.3" />
      </svg>
    </div>
  )
}
