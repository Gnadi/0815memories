import { useNavigate } from 'react-router-dom'
import { useState, useRef } from 'react'
import { MoreHorizontal, Pencil, Trash2, ChevronLeft, ChevronRight, Mic, Video } from 'lucide-react'
import { formatDate } from '../../utils/helpers'
import { useAuth } from '../../context/AuthContext'
import EncryptedImage from '../media/EncryptedImage'
import { resolvePolaroidBorder, isLightPolaroidColor, getPolaroidFrameStyle } from './polaroidBorder'

const WIDTH_PRESETS = {
  thin: { frame: 8, captionBottom: 72 },
  medium: { frame: 14, captionBottom: 84 },
  thick: { frame: 22, captionBottom: 104 },
}

export default function MemoryCardPolaroid({ memory, onEdit, onDelete }) {
  const [showMenu, setShowMenu] = useState(false)
  const [imgIndex, setImgIndex] = useState(0)
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const touchStartX = useRef(null)

  const border = resolvePolaroidBorder(memory.polaroidBorder)
  const preset = WIDTH_PRESETS[border.width] || WIDTH_PRESETS.medium
  const lightFrame = isLightPolaroidColor(border.color)
  const contrast = lightFrame ? 'rgba(45, 27, 14, 0.45)' : 'rgba(253, 246, 236, 0.55)'
  const captionTextColor = lightFrame ? '#2D1B0E' : '#FDF6EC'
  const captionMutedColor = lightFrame ? 'rgba(45, 27, 14, 0.6)' : 'rgba(253, 246, 236, 0.7)'

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

  const innerBorder =
    border.style === 'dashed'
      ? `2px dashed ${contrast}`
      : border.style === 'double'
        ? `4px double ${contrast}`
        : 'none'

  return (
    <div
      className="cursor-pointer relative"
      onClick={() => navigate(`/memory/${memory.id}`)}
      style={{ transform: 'rotate(-1.2deg)', transition: 'transform 200ms' }}
    >
      <div
        className="relative shadow-xl"
        style={{
          ...getPolaroidFrameStyle(border),
          paddingTop: preset.frame,
          paddingLeft: preset.frame,
          paddingRight: preset.frame,
          paddingBottom: preset.captionBottom,
        }}
      >
        {/* Tape decoration */}
        {border.decoration === 'tape' && (
          <div
            className="absolute z-20 pointer-events-none"
            style={{
              top: -10,
              left: '50%',
              width: 90,
              height: 22,
              backgroundColor: 'rgba(254, 240, 138, 0.78)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
              transform: 'translateX(-50%) rotate(-4deg)',
            }}
          />
        )}

        {/* Photo area */}
        <div
          className="relative aspect-square overflow-hidden bg-cream-dark"
          onTouchStart={allImages.length > 1 ? onTouchStart : undefined}
          onTouchEnd={allImages.length > 1 ? onTouchEnd : undefined}
        >
          {allImages.length > 0 ? (
            <>
              <EncryptedImage
                src={allImages[imgIndex]}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-70"
              />
              <EncryptedImage
                src={allImages[imgIndex]}
                alt={memory.title}
                className="relative z-[1] w-full h-full object-contain"
              />
            </>
          ) : (
            <MemoryPlaceholderImage title={memory.title} />
          )}

          <div className="absolute bottom-2 left-2 z-10 flex gap-1.5">
            {memory.voiceMemos?.length > 0 && (
              <span className="flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                <Mic className="w-3 h-3" /> {memory.voiceMemos.length}
              </span>
            )}
            {memory.videos?.length > 0 && (
              <span className="flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                <Video className="w-3 h-3" /> {memory.videos.length}
              </span>
            )}
          </div>

          {allImages.length > 1 && (
            <>
              <button
                onClick={prevImg}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextImg}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="absolute top-2 right-2 z-10 bg-black/50 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                {imgIndex + 1} / {allImages.length}
              </span>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-1">
                {allImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation()
                      setImgIndex(i)
                    }}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === imgIndex ? 'bg-white' : 'bg-white/50'}`}
                  />
                ))}
              </div>
            </>
          )}

          {innerBorder !== 'none' && (
            <div
              className="absolute inset-0 z-[5] pointer-events-none"
              style={{ border: innerBorder }}
            />
          )}

          {border.decoration === 'corners' && (
            <>
              <span
                className="absolute top-0 left-0 z-[6] pointer-events-none"
                style={{
                  width: 18,
                  height: 18,
                  background: 'rgba(0,0,0,0.35)',
                  clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                }}
              />
              <span
                className="absolute top-0 right-0 z-[6] pointer-events-none"
                style={{
                  width: 18,
                  height: 18,
                  background: 'rgba(0,0,0,0.35)',
                  clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
                }}
              />
              <span
                className="absolute bottom-0 left-0 z-[6] pointer-events-none"
                style={{
                  width: 18,
                  height: 18,
                  background: 'rgba(0,0,0,0.35)',
                  clipPath: 'polygon(0 0, 0 100%, 100% 100%)',
                }}
              />
              <span
                className="absolute bottom-0 right-0 z-[6] pointer-events-none"
                style={{
                  width: 18,
                  height: 18,
                  background: 'rgba(0,0,0,0.35)',
                  clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
                }}
              />
            </>
          )}
        </div>

        {/* Caption strip — fills the wide bottom margin */}
        <div
          className="absolute left-0 right-0 flex items-start justify-between gap-2"
          style={{
            bottom: 8,
            paddingLeft: preset.frame + 6,
            paddingRight: preset.frame + 6,
          }}
        >
          <div className="flex-1 min-w-0 text-center">
            <p
              className="font-display text-base leading-tight truncate"
              style={{ color: captionTextColor }}
            >
              {memory.title || formatDate(memory.date)}
            </p>
            <p
              className="text-[11px] mt-0.5 truncate"
              style={{ color: captionMutedColor }}
            >
              {memory.title ? (
                <>
                  {formatDate(memory.date)}
                  {memory.location && (
                    <>
                      <span className="mx-1.5 opacity-70">·</span>
                      {memory.location}
                    </>
                  )}
                </>
              ) : (
                memory.location || memory.quote || ''
              )}
            </p>
          </div>
          {isAdmin && (
            <div className="relative -mt-1">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(!showMenu)
                }}
                className="p-1"
                style={{ color: captionMutedColor }}
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-8 bg-white rounded-xl shadow-lg py-2 z-50 min-w-[140px]">
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
      </div>
    </div>
  )
}

function MemoryPlaceholderImage({ title }) {
  const hue = title ? (title.charCodeAt(0) * 5) % 360 : 30
  return (
    <div
      className="w-full h-full flex items-center justify-center"
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
