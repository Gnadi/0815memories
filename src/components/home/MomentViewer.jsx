import { useState, useEffect, useRef } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Share2,
  MapPin,
  ChevronsUp,
} from 'lucide-react'
import { timeAgo } from '../../utils/helpers'

export default function MomentViewer({ moments, initialIndex, onClose }) {
  const [currentMomentIndex, setCurrentMomentIndex] = useState(initialIndex ?? 0)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [progress, setProgress] = useState(0)   // 0–100, fill % for current image
  const [paused, setPaused] = useState(false)
  const [infoVisible, setInfoVisible] = useState(true)

  const moment = moments[currentMomentIndex]
  const images = moment?.images ?? []
  const isFirstImage = currentImageIndex === 0
  const isLastImage = currentImageIndex === images.length - 1
  const isFirstMoment = currentMomentIndex === 0
  const isLastMoment = currentMomentIndex === moments.length - 1
  const isAtStart = isFirstMoment && isFirstImage
  const isAtEnd = isLastMoment && isLastImage

  // Keep a stable ref to goNext to avoid stale closures inside setInterval
  const goNextRef = useRef(null)

  const goNext = () => {
    if (!isLastImage) {
      setCurrentImageIndex((i) => i + 1)
    } else if (!isLastMoment) {
      setCurrentMomentIndex((i) => i + 1)
    } else {
      onClose()
    }
  }

  const goPrev = () => {
    if (!isFirstImage) {
      setCurrentImageIndex((i) => i - 1)
    } else if (!isFirstMoment) {
      const prevMoment = moments[currentMomentIndex - 1]
      const prevImages = prevMoment?.images ?? []
      setCurrentMomentIndex((i) => i - 1)
      setCurrentImageIndex(Math.max(0, prevImages.length - 1))
    }
  }

  goNextRef.current = goNext

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Reset progress + unpause on image/moment change
  useEffect(() => {
    setProgress(0)
    setPaused(false)
  }, [currentImageIndex, currentMomentIndex])

  // Reset image index when switching moments
  useEffect(() => {
    setCurrentImageIndex(0)
  }, [currentMomentIndex])

  // Restore info card visibility on new moment
  useEffect(() => {
    setInfoVisible(true)
  }, [currentMomentIndex])

  // Always-fresh refs so interval callbacks never capture stale values
  const isAtEndRef = useRef(isAtEnd)
  isAtEndRef.current = isAtEnd
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Auto-advance timer: 2% per 100ms = 5 000ms total
  // Only increments progress — side effects (goNext / onClose) live in the effect below
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 2
        return next >= 100 ? 100 : next
      })
    }, 100)
    return () => clearInterval(id)
  }, [paused, currentImageIndex, currentMomentIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // When progress reaches 100, advance to next image or close
  useEffect(() => {
    if (progress < 100) return
    if (isAtEndRef.current) {
      onCloseRef.current()
    } else {
      goNextRef.current()
    }
  }, [progress]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  if (!moment) return null

  const currentImage = images[currentImageIndex]
  const authorName = moment.authorName || 'Family'
  const authorInitials = authorName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // Progress bar segments — one per image in the current moment
  const ProgressBarMobile = () => (
    <div className="flex gap-1 w-full">
      {images.map((_, i) => (
        <div key={i} className="h-0.5 flex-1 rounded-full bg-white/30 overflow-hidden">
          <div
            className="h-full rounded-full bg-white"
            style={{
              width:
                i < currentImageIndex ? '100%'
                : i === currentImageIndex ? `${progress}%`
                : '0%',
              transition: paused ? 'none' : undefined,
            }}
          />
        </div>
      ))}
    </div>
  )

  const ProgressBarDesktop = () => (
    <div className="flex gap-1 w-full">
      {images.map((_, i) => (
        <div key={i} className="h-1 flex-1 rounded-full bg-cream-dark overflow-hidden">
          <div
            className="h-full rounded-full bg-hearth"
            style={{
              width:
                i < currentImageIndex ? '100%'
                : i === currentImageIndex ? `${progress}%`
                : '0%',
              transition: paused ? 'none' : undefined,
            }}
          />
        </div>
      ))}
    </div>
  )

  return (
    <>
      {/* ─── MOBILE: full-screen story ─── */}
      <div
        className="md:hidden fixed inset-0 z-50"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerCancel={() => setPaused(false)}
      >
        {/* Background image */}
        {currentImage ? (
          <img
            src={currentImage}
            alt={moment.caption}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-bark" />
        )}

        {/* Top gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent pointer-events-none" />

        {/* Top bar — z-20 so it sits above the tap zones */}
        <div className="absolute top-0 left-0 right-0 px-4 pt-10 pb-2 z-20">
          <ProgressBarMobile />

          {/* User row */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2.5">
              <div className="story-ring">
                <div className="story-ring-inner">
                  <div className="w-8 h-8 rounded-full bg-hearth flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{authorInitials}</span>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-tight">{authorName}</p>
                <p className="text-white/70 text-xs">{timeAgo(moment.date)}</p>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onClose() }}
              onPointerDown={(e) => e.stopPropagation()}
              className="text-white/80 hover:text-white"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tap zones for navigation (z-10, below top bar) */}
        <button
          onClick={goPrev}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          disabled={isAtStart}
          className="absolute left-0 top-0 bottom-48 w-1/3 z-10 disabled:cursor-default"
          aria-label="Previous"
        />
        <button
          onClick={goNext}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          disabled={isAtEnd}
          className="absolute right-0 top-0 bottom-48 w-1/3 z-10 disabled:cursor-default"
          aria-label="Next"
        />

        {/* Bottom info card — first image only */}
        {currentImageIndex === 0 && infoVisible && (
          <div className="absolute bottom-0 left-0 right-0 p-4 pb-8 z-20">
            <div className="relative bg-cream/70 backdrop-blur-sm rounded-3xl px-5 py-4 shadow-lg">
              {/* Close info button */}
              <button
                onClick={(e) => { e.stopPropagation(); setInfoVisible(false) }}
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute top-2 right-2 text-bark-muted hover:text-bark"
                aria-label="Hide info"
              >
                <X className="w-4 h-4" />
              </button>

              {moment.caption && (
                <p className="text-bark italic text-sm leading-relaxed mb-2 pr-5">
                  "{moment.caption}"
                </p>
              )}
              {(moment.category || moment.location) && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {moment.category && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                      <Heart className="w-3 h-3" />
                      {moment.category}
                    </span>
                  )}
                  {moment.location && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                      <MapPin className="w-3 h-3" />
                      {moment.location}
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center justify-center gap-1 pt-2 border-t border-cream-dark">
                <ChevronsUp className="w-4 h-4 text-bark-muted" />
                <span className="text-xs font-semibold text-bark-muted tracking-widest uppercase">
                  Swipe up to reply
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── DESKTOP: centered card modal ─── */}
      <div className="hidden md:flex fixed inset-0 z-50 items-center justify-center">
        {/* Dark backdrop */}
        <div className="absolute inset-0 bg-black/70" onClick={onClose} />

        {/* Left arrow */}
        <button
          onClick={goPrev}
          disabled={isAtStart}
          className="relative z-10 mr-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          aria-label="Previous"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Card */}
        <div className="relative z-10 w-[420px] bg-warm-white rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
          {/* Progress bar */}
          <div className="px-4 pt-4">
            <ProgressBarDesktop />
          </div>

          {/* User info row */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-hearth flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{authorInitials}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-bark leading-tight">{authorName}</p>
                <p className="text-xs text-bark-muted">{timeAgo(moment.date)}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-bark-muted hover:text-bark"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Image — press to pause */}
          <div
            className="relative cursor-pointer select-none"
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onPointerLeave={() => setPaused(false)}
            onPointerCancel={() => setPaused(false)}
          >
            {currentImage ? (
              <img
                src={currentImage}
                alt={moment.caption}
                className="w-full aspect-[4/5] object-cover pointer-events-none"
                draggable={false}
              />
            ) : (
              <div className="w-full aspect-[4/5] bg-cream-dark flex items-center justify-center">
                <span className="text-bark-muted text-sm">No image</span>
              </div>
            )}
          </div>

          {/* Caption pill — first image only */}
          {currentImageIndex === 0 && infoVisible && (moment.caption || moment.category || moment.location) && (
            <div className="mx-4 -mt-6 relative z-10">
              <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-md">
                {/* Close info button */}
                <button
                  onClick={() => setInfoVisible(false)}
                  className="absolute top-2 right-2 text-bark-muted hover:text-bark"
                  aria-label="Hide info"
                >
                  <X className="w-4 h-4" />
                </button>

                {moment.caption && (
                  <p className="text-bark text-sm leading-relaxed pr-5">
                    <span className="italic">{moment.caption}</span>
                  </p>
                )}
                {(moment.category || moment.location) && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {moment.category && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                        <Heart className="w-3 h-3" />
                        {moment.category}
                      </span>
                    )}
                    {moment.location && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                        <MapPin className="w-3 h-3" />
                        {moment.location}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reaction row */}
          <div className="flex items-center gap-5 px-4 py-3 mt-1">
            <button className="flex items-center gap-1.5 text-bark-muted hover:text-hearth transition-colors">
              <Heart className="w-5 h-5" />
              <span className="text-xs font-medium">0</span>
            </button>
            <button className="flex items-center gap-1.5 text-bark-muted hover:text-bark transition-colors">
              <MessageCircle className="w-5 h-5" />
              <span className="text-xs font-medium">0</span>
            </button>
            <button className="flex items-center gap-1.5 text-bark-muted hover:text-bark transition-colors ml-auto">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Right arrow */}
        <button
          onClick={goNext}
          disabled={isAtEnd}
          className="relative z-10 ml-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          aria-label="Next"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </>
  )
}
