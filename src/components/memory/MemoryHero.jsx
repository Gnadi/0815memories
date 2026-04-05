import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react'
import EncryptedImage from '../media/EncryptedImage'

function useSwipe(onPrev, onNext) {
  const startX = useRef(null)
  return {
    onTouchStart: (e) => { startX.current = e.touches[0].clientX },
    onTouchEnd: (e) => {
      if (startX.current === null) return
      const delta = startX.current - e.changedTouches[0].clientX
      if (Math.abs(delta) > 40) delta > 0 ? onNext() : onPrev()
      startX.current = null
    },
  }
}

export default function MemoryHero({ images, imageUrl, category }) {
  const allImages = images?.length ? images : (imageUrl ? [imageUrl] : [])
  const [index, setIndex] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)

  const prev = () => setIndex((i) => (i - 1 + allImages.length) % allImages.length)
  const next = () => setIndex((i) => (i + 1) % allImages.length)

  const heroSwipe = useSwipe(prev, next)
  const lightboxSwipe = useSwipe(prev, next)

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setFullscreen(false)
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [fullscreen, allImages.length])

  return (
    <>
      {/* Hero */}
      <div
        className="relative w-full h-72 sm:h-96 lg:h-[520px] rounded-2xl overflow-hidden"
        {...(allImages.length > 1 ? heroSwipe : {})}
      >
        {allImages.length > 0 ? (
          <>
            <EncryptedImage
              key={allImages[index]}
              src={allImages[index]}
              alt=""
              className="w-full h-full object-cover"
              onClick={() => setFullscreen(true)}
            />

            {/* Fullscreen button */}
            <button
              onClick={() => setFullscreen(true)}
              className="absolute top-3 left-3 w-8 h-8 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition-colors"
              title="View fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {allImages.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); prev() }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); next() }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                <span className="absolute top-3 right-3 bg-black/50 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                  {index + 1} / {allImages.length}
                </span>

                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {allImages.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); setIndex(i) }}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-white/50'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <HeroPlaceholder />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />
        {category && (
          <span className="absolute bottom-4 left-4 text-white text-xs font-bold tracking-widest uppercase drop-shadow">
            {category}
          </span>
        )}
      </div>

      {/* Fullscreen lightbox */}
      {fullscreen && allImages.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => setFullscreen(false)}
          {...lightboxSwipe}
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors z-10"
            onClick={() => setFullscreen(false)}
          >
            <X className="w-5 h-5" />
          </button>

          {allImages.length > 1 && (
            <span className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium">
              {index + 1} / {allImages.length}
            </span>
          )}

          <EncryptedImage
            src={allImages[index]}
            alt=""
            className="max-w-full max-h-full object-contain select-none"
            onClick={(e) => e.stopPropagation()}
          />

          {allImages.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
                onClick={(e) => { e.stopPropagation(); prev() }}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
                onClick={(e) => { e.stopPropagation(); next() }}
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                {allImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setIndex(i) }}
                    className={`w-2 h-2 rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-white/40'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

function HeroPlaceholder() {
  return (
    <svg viewBox="0 0 800 400" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="heroGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF8C00" />
          <stop offset="100%" stopColor="#8B4513" />
        </linearGradient>
      </defs>
      <rect width="800" height="400" fill="url(#heroGrad)" />
      <path d="M0,400 L0,200 L40,180 L60,250 L80,160 L100,240 L130,140 L160,230 L180,170 L200,220 L220,150 L250,280 L250,400Z" fill="#2D1B0E" opacity="0.3" />
      <path d="M550,400 L550,220 L580,190 L600,260 L630,170 L660,250 L690,150 L720,240 L750,180 L780,230 L800,200 L800,400Z" fill="#2D1B0E" opacity="0.3" />
      <rect x="280" y="80" width="240" height="180" rx="10" fill="#FFD700" opacity="0.25" />
      <circle cx="350" cy="220" r="15" fill="#2D1B0E" opacity="0.5" />
      <rect x="340" y="235" width="20" height="40" rx="5" fill="#2D1B0E" opacity="0.5" />
      <circle cx="400" cy="210" r="18" fill="#2D1B0E" opacity="0.5" />
      <rect x="388" y="228" width="24" height="45" rx="5" fill="#2D1B0E" opacity="0.5" />
      <circle cx="460" cy="235" r="12" fill="#2D1B0E" opacity="0.5" />
      <rect x="452" y="247" width="16" height="30" rx="4" fill="#2D1B0E" opacity="0.5" />
    </svg>
  )
}
