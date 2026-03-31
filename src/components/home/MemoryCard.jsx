import { useNavigate } from 'react-router-dom'
import { MoreHorizontal, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useRef } from 'react'
import { formatDate } from '../../utils/helpers'
import { useAuth } from '../../context/AuthContext'

export default function MemoryCard({ memory, onEdit, onDelete }) {
  const [showMenu, setShowMenu] = useState(false)
  const [imgIndex, setImgIndex] = useState(0)
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const touchStartX = useRef(null)

  const allImages = memory.images?.length ? memory.images : (memory.imageUrl ? [memory.imageUrl] : [])

  const prevImg = (e) => {
    e?.stopPropagation()
    setImgIndex((i) => (i - 1 + allImages.length) % allImages.length)
  }
  const nextImg = (e) => {
    e?.stopPropagation()
    setImgIndex((i) => (i + 1) % allImages.length)
  }

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
  }
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const delta = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(delta) > 40) {
      e.stopPropagation()
      delta > 0 ? nextImg() : prevImg()
    }
    touchStartX.current = null
  }

  return (
    <div
      className="bg-warm-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => navigate(`/memory/${memory.id}`)}
    >
      {/* Image slider */}
      {allImages.length > 0 ? (
        <div
          className="relative"
          onTouchStart={allImages.length > 1 ? onTouchStart : undefined}
          onTouchEnd={allImages.length > 1 ? onTouchEnd : undefined}
        >
          <img
            src={allImages[imgIndex]}
            alt={memory.title}
            className="w-full h-64 object-cover"
          />

          {allImages.length > 1 && (
            <>
              <button
                onClick={prevImg}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextImg}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <span className="absolute top-2 right-2 bg-black/50 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                {imgIndex + 1} / {allImages.length}
              </span>

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {allImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setImgIndex(i) }}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === imgIndex ? 'bg-white' : 'bg-white/50'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <MemoryPlaceholderImage title={memory.title} />
      )}

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
      className="w-full h-64 flex items-center justify-center"
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
