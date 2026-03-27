import React from 'react'
import { useNavigate } from 'react-router-dom'
import { cloudinaryUrl } from '../utils/cloudinary'

function formatDate(dateValue) {
  if (!dateValue) return ''
  const d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue)
  const now = new Date()
  const diff = Math.floor((now - d) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

/**
 * Memory feed card.
 * Supports single-image (large) and multi-image (2-column grid) layouts.
 */
export default function MemoryCard({ memory, compact = false }) {
  const navigate = useNavigate()
  const { id, title, description, images = [], date, location, category } = memory

  const primaryImage = images[0]
  const extraImages = images.slice(1, 5)

  return (
    <div
      className="card cursor-pointer hover:shadow-card-hover transition-shadow duration-200 overflow-hidden p-0"
      onClick={() => navigate(`/memory/${id}`)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-sm font-medium text-hearth-muted">{formatDate(date)}</span>
        <button
          onClick={e => { e.stopPropagation() }}
          className="text-hearth-muted hover:text-hearth-text p-1"
        >
          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
        </button>
      </div>

      {/* Images */}
      {images.length === 1 && primaryImage && (
        <div className="w-full aspect-[4/3] overflow-hidden mx-0 mb-0">
          <img
            src={cloudinaryUrl(primaryImage, { width: 800, height: 600 })}
            alt={title}
            className="w-full h-full object-cover rounded-b-none"
            loading="lazy"
          />
        </div>
      )}

      {images.length >= 2 && (
        <div className="grid grid-cols-2 gap-1 px-0">
          {images.slice(0, 4).map((img, i) => (
            <div key={i} className="aspect-square overflow-hidden">
              <img
                src={cloudinaryUrl(img, { width: 400, height: 400 })}
                alt={`${title} ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}

      {/* Body */}
      {(title || description) && (
        <div className="px-4 py-4">
          {category && (
            <span className="text-xs font-bold uppercase tracking-wider text-terra mb-1 block">
              {category}
            </span>
          )}
          {!compact && description && (
            <p className="text-hearth-text text-base leading-relaxed line-clamp-3">
              {description}
            </p>
          )}
          {compact && title && (
            <p className="text-hearth-text text-sm font-semibold line-clamp-2">{title}</p>
          )}
        </div>
      )}
    </div>
  )
}
