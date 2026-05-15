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
  const captionTilt = -filmTilt * 0.6

  const frameNumber = allImages.length > 0 ? imgIndex + 1 : 1
  const frameTotal = allImages.length > 0 ? allImages.length : 1
  const totalLabel = `${frameTotal}A`

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
      className="cursor-pointer pt-2 pb-3"
      onClick={() => navigate(`/memory/${memory.id}`)}
    >
      {/* Film frame */}
      <div
        className="relative bg-bark rounded-sm shadow-lg transition-transform"
        style={{ transform: `rotate(${filmTilt}deg)` }}
      >
        {/* Top film strip: frame number + KODAK-style branding */}
        <div className="flex items-center justify-between px-3 pt-1.5 text-cream/90 font-display text-[10px] tracking-[0.18em] uppercase">
          <span className="tabular-nums">{frameNumber}</span>
          <span className="opacity-90">0815&nbsp;MEMORIES&nbsp;200&nbsp;PX</span>
          <span className="tabular-nums">{totalLabel}</span>
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

        {/* Bottom film strip */}
        <SprocketRow />
        <div className="flex items-center justify-between px-3 pb-1.5 text-cream/90 font-display text-[10px] tracking-[0.18em] uppercase">
          <span className="tabular-nums">{frameNumber}</span>
          <span className="opacity-80">&#9670;&nbsp;&nbsp;&#9670;&nbsp;&nbsp;&#9670;</span>
          <span className="tabular-nums">{totalLabel}</span>
        </div>
      </div>

      {/* Polaroid-style caption strip */}
      <div
        className="relative bg-warm-white rounded-sm shadow-md -mt-1 mx-3 px-4 pt-3 pb-6 transition-transform"
        style={{ transform: `rotate(${captionTilt}deg)` }}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-serif italic text-base text-bark leading-snug">
            {formatDate(memory.date)}
          </p>
          {isAdmin && (
            <div className="relative -mr-1 -mt-1">
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

        {memory.content && (
          <p className="mt-1 font-serif italic text-sm text-bark-light line-clamp-2">
            &ldquo;{memory.content}&rdquo;
          </p>
        )}

        {memory.quote && (
          <p className="mt-2 font-serif italic text-xs text-bark-muted text-center">
            {memory.quote}
          </p>
        )}
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
