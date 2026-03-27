import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMemory } from '../hooks/useMemories'
import { cloudinaryUrl } from '../utils/cloudinary'

function formatFullDate(dateValue) {
  if (!dateValue) return ''
  const d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function MemoryDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { memory, loading, error } = useMemory(id)
  const [activeImage, setActiveImage] = useState(0)

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="w-full aspect-[16/9] bg-hearth-border rounded-2xl" />
        <div className="h-5 w-32 bg-hearth-border rounded" />
        <div className="h-8 w-2/3 bg-hearth-border rounded" />
        <div className="space-y-2">
          <div className="h-4 w-full bg-hearth-border rounded" />
          <div className="h-4 w-5/6 bg-hearth-border rounded" />
          <div className="h-4 w-4/6 bg-hearth-border rounded" />
        </div>
      </div>
    )
  }

  if (error || !memory) {
    return (
      <div className="text-center py-20">
        <p className="text-hearth-muted text-lg">Memory not found.</p>
        <button onClick={() => navigate('/home')} className="btn-primary mt-4 text-sm">
          Go home
        </button>
      </div>
    )
  }

  const images = memory.images ?? []
  const primaryImage = images[activeImage] ?? images[0]

  return (
    <div className="max-w-2xl mx-auto -mx-4 md:mx-0">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-hearth-muted hover:text-hearth-text text-sm font-medium mb-4 px-4 md:px-0"
      >
        <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back
      </button>

      {/* Hero image */}
      {primaryImage && (
        <div className="relative rounded-2xl overflow-hidden mb-5">
          <img
            src={cloudinaryUrl(primaryImage, { width: 900, height: 500 })}
            alt={memory.title}
            className="w-full aspect-[16/9] object-cover"
          />
          {memory.category && (
            <div className="absolute bottom-4 left-4">
              <span className="text-white text-xs font-bold uppercase tracking-widest bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full">
                {memory.category}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Image strip */}
      {images.length > 1 && (
        <div className="flex gap-2 mb-5 px-4 md:px-0 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveImage(i)}
              className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all duration-150 ${
                activeImage === i ? 'border-terra' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={cloudinaryUrl(img, { width: 128, height: 128 })}
                alt=""
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Meta */}
      <div className="px-4 md:px-0">
        <div className="flex flex-wrap items-center gap-3 mb-4 text-sm text-hearth-muted">
          {memory.date && (
            <span className="flex items-center gap-1.5">
              <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current text-terra">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              {formatFullDate(memory.date)}
            </span>
          )}
          {memory.location && (
            <span className="flex items-center gap-1.5">
              <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current text-terra">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              {memory.location}
            </span>
          )}
        </div>

        {/* Title */}
        {memory.title && (
          <h1 className="text-3xl font-extrabold text-hearth-text leading-tight mb-4">
            {memory.title}
          </h1>
        )}

        {/* Quote block */}
        {memory.quote && (
          <blockquote className="border-l-4 border-terra pl-4 mb-5">
            <p className="text-hearth-muted italic text-base leading-relaxed">
              "{memory.quote}"
            </p>
          </blockquote>
        )}

        {/* Body text */}
        {memory.description && (
          <div className="prose prose-sm max-w-none">
            {memory.description.split('\n\n').map((para, i) => (
              <p key={i} className="text-hearth-text text-base leading-relaxed mb-4">
                {para}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
