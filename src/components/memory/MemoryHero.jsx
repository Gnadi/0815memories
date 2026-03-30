import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function MemoryHero({ images, imageUrl, category }) {
  const allImages = images?.length ? images : (imageUrl ? [imageUrl] : [])
  const [index, setIndex] = useState(0)

  const prev = (e) => {
    e.stopPropagation()
    setIndex((i) => (i - 1 + allImages.length) % allImages.length)
  }
  const next = (e) => {
    e.stopPropagation()
    setIndex((i) => (i + 1) % allImages.length)
  }

  return (
    <div className="relative w-full h-64 sm:h-80 lg:h-96 rounded-2xl overflow-hidden">
      {allImages.length > 0 ? (
        <>
          <img
            key={allImages[index]}
            src={allImages[index]}
            alt=""
            className="w-full h-full object-cover"
          />

          {allImages.length > 1 && (
            <>
              {/* Prev button */}
              <button
                onClick={prev}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* Next button */}
              <button
                onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Counter badge */}
              <span className="absolute top-3 right-3 bg-black/50 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                {index + 1} / {allImages.length}
              </span>

              {/* Dot indicators */}
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-1.5">
                {allImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setIndex(i) }}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      i === index ? 'bg-white' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <HeroPlaceholder />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
      {category && (
        <span className="absolute bottom-4 left-4 text-white text-xs font-bold tracking-widest uppercase drop-shadow">
          {category}
        </span>
      )}
    </div>
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
      {/* Trees silhouette */}
      <path d="M0,400 L0,200 L40,180 L60,250 L80,160 L100,240 L130,140 L160,230 L180,170 L200,220 L220,150 L250,280 L250,400Z" fill="#2D1B0E" opacity="0.3" />
      <path d="M550,400 L550,220 L580,190 L600,260 L630,170 L660,250 L690,150 L720,240 L750,180 L780,230 L800,200 L800,400Z" fill="#2D1B0E" opacity="0.3" />
      {/* Window/sunset glow */}
      <rect x="280" y="80" width="240" height="180" rx="10" fill="#FFD700" opacity="0.25" />
      {/* Family figures looking out */}
      <circle cx="350" cy="220" r="15" fill="#2D1B0E" opacity="0.5" />
      <rect x="340" y="235" width="20" height="40" rx="5" fill="#2D1B0E" opacity="0.5" />
      <circle cx="400" cy="210" r="18" fill="#2D1B0E" opacity="0.5" />
      <rect x="388" y="228" width="24" height="45" rx="5" fill="#2D1B0E" opacity="0.5" />
      <circle cx="460" cy="235" r="12" fill="#2D1B0E" opacity="0.5" />
      <rect x="452" y="247" width="16" height="30" rx="4" fill="#2D1B0E" opacity="0.5" />
    </svg>
  )
}
