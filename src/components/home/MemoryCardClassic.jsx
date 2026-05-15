import { useNavigate } from 'react-router-dom'
import { MoreHorizontal, Pencil, Trash2, ChevronLeft, ChevronRight, Mic, Video } from 'lucide-react'
import { useState, useRef, useMemo } from 'react'
import { formatDate } from '../../utils/helpers'
import { useAuth } from '../../context/AuthContext'
import EncryptedImage from '../media/EncryptedImage'

const SPROCKET_COUNT = 14

function SprocketRow() {
  return (
    <div className="flex items-center justify-between gap-1 px-1 py-1">
      {Array.from({ length: SPROCKET_COUNT }).map((_, i) => (
        <span
          key={i}
          className="block w-2 h-1.5 rounded-[2px] bg-cream/90"
        />
      ))}
    </div>
  )
}

function tiltFor(id) {
  if (!id) return 0
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return ((h % 5) - 2) * 0.4
}

export default function MemoryCardClassic({ memory, onEdit, onDelete }) {
  const [showMenu, setShowMenu] = useState(false)
  const [imgIndex, setImgIndex] = useState(0)
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const touchStartX = useRef(null)

  const allImages = memory.images?.length ? memory.images : (memory.imageUrl ? [memory.imageUrl] : [])

  const filmTilt = useMemo(() => tiltFor(memory.id), [memory.id])

  const frameNumber = allImages.length > 0 ? imgIndex + 1 : 1
  const frameTotal = allImages.length > 0 ? allImages.length : 1
  const totalLabel = `${frameTotal}A`

  const captionText = memory.content || memory.quote || '0815 MEMORIES 200 PX'

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
      className="cursor-pointer py-2"
      onClick={() => navigate(`/memory/${memory.id}`)}
    >
      {/* Film frame */}
      <div
        className="relative bg-bark rounded-sm shadow-lg transition-transform"
        style={{ transform: `rotate(${filmTilt}deg)` }}
      >
        {/* Top film strip: frame number + date · location + total */}
        <div className="flex items-center gap-3 px-3 pt-2 pb-1 text-cream/95 font-display text-[11px] tracking-[0.18em] uppercase">
          <span className="tabular-nums shrink-0">{frameNumber}</span>
          <span className="flex-1 text-center truncate">
            {formatDate(memory.date)}
            {memory.location && (
              <>
                <span className="mx-2 text-cream/60">&bull;</span>
                {memory.location}
              </>
            )}
          </span>
          <span className="tabular-nums shrink-0">{totalLabel}</span>
        </div>
        <SprocketRow />

        {/* Photo area */}
        <div
          className="relative aspect-square bg-cream-dark overflow-hidden mx-2"
          onTouchStart={allImages.length > 1 ? onTouchStart : undefined}
          onTouchEnd={allImages.length > 1 ? onTouchEnd : undefined}
        >
          {allImages.length > 0 ? (
            <>
              {/* Blurred backdrop fills letterbox space around the photo */}
              <EncryptedImage
                src={allImages[imgIndex]}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-70"
              />
              {/* Actual photo, fully visible */}
              <EncryptedImage
                src={allImages[imgIndex]}
                alt={memory.title}
                className="relative z-[1] w-full h-full object-contain"
              />

              {allImages.length > 1 && (
                <>
                  <button
                    onClick={prevImg}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-bark/70 hover:bg-bark/85 rounded-full flex items-center justify-center text-cream transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={nextImg}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-bark/70 hover:bg-bark/85 rounded-full flex items-center justify-center text-cream transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-1">
                    {allImages.map((_, i) => (
                      <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); setImgIndex(i) }}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${i === imgIndex ? 'bg-cream' : 'bg-cream/50'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <ClassicPlaceholderImage title={memory.title} />
          )}

          {/* Media count badges, restyled cream-on-bark */}
          <div className="absolute bottom-2 left-2 z-10 flex gap-1.5">
            {memory.voiceMemos?.length > 0 && (
              <span className="flex items-center gap-1 bg-bark/70 text-cream text-xs px-2 py-0.5 rounded-full">
                <Mic className="w-3 h-3" /> {memory.voiceMemos.length}
              </span>
            )}
            {memory.videos?.length > 0 && (
              <span className="flex items-center gap-1 bg-bark/70 text-cream text-xs px-2 py-0.5 rounded-full">
                <Video className="w-3 h-3" /> {memory.videos.length}
              </span>
            )}
          </div>
        </div>

        {/* Bottom film strip: caption + admin menu */}
        <SprocketRow />
        <div className="flex items-center gap-3 px-3 pt-1 pb-2 text-cream/95 font-display text-[11px] tracking-[0.18em] uppercase">
          <span className="tabular-nums shrink-0">{frameNumber}</span>
          <span className="flex-1 text-center truncate">{captionText}</span>
          {isAdmin ? (
            <div className="relative shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(!showMenu)
                }}
                className="block text-cream/80 hover:text-cream p-0.5 -my-0.5"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showMenu && (
                <div className="absolute right-0 bottom-7 bg-white rounded-xl shadow-lg py-2 z-50 min-w-[140px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowMenu(false)
                      onEdit?.(memory)
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-bark hover:bg-cream-dark normal-case tracking-normal font-sans"
                  >
                    <Pencil className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowMenu(false)
                      onDelete?.(memory.id)
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 normal-case tracking-normal font-sans"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              )}
            </div>
          ) : (
            <span className="tabular-nums shrink-0">{totalLabel}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function ClassicPlaceholderImage({ title }) {
  const hue = title ? title.charCodeAt(0) * 5 % 360 : 30
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
