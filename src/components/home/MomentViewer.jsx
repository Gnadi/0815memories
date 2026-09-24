import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Heart,
  MapPin,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { timeAgo } from '../../utils/helpers'
import { useAuth } from '../../context/AuthContext'
import CrossfadeImage, { FADE_MS } from '../media/CrossfadeImage'
import EncryptedVideo from '../media/EncryptedVideo'
import { prefetchDecryptedMedia } from '../media/useDecryptedMedia'
import { thumbAt, tinyPreviewAt } from '../../utils/mediaThumbs'
import useMediaQuery from '../../hooks/useMediaQuery'

// Build a unified media list from a moment's images and videos.
//
// Images carry their derivatives with them: `thumbUrl` is the 1024px copy the
// story circle already decrypted, `tinyPreview` the ~20px blur-up that rides on
// the document. Videos have neither — there is one asset and it is the clip.
function buildMediaItems(moment) {
  const images = moment?.images ?? []
  const videos = moment?.videos ?? []
  return [
    ...images.map((url, i) => ({
      type: 'image',
      url,
      thumbUrl: thumbAt(moment, i),
      tinyPreview: tinyPreviewAt(moment, i),
    })),
    ...videos.map((v) => ({ type: 'video', url: v.url })),
  ]
}

// The media item `steps` taps away from (momentIndex, mediaIndex), walking into
// the neighbouring moments the way goNext and goPrev do. Null past either end.
function itemAtOffset(moments, momentIndex, mediaIndex, steps) {
  let m = momentIndex
  let i = mediaIndex + steps
  let items = buildMediaItems(moments[m])
  while (i >= items.length) {
    i -= items.length
    m += 1
    if (m >= moments.length) return null
    items = buildMediaItems(moments[m])
  }
  while (i < 0) {
    m -= 1
    if (m < 0) return null
    items = buildMediaItems(moments[m])
    i += items.length
  }
  return items[i] ?? null
}

export default function MomentViewer({ moments, initialIndex, onClose, isAdmin, onEdit, onDelete }) {
  const { t } = useTranslation('home')
  const { encryptionKey } = useAuth()
  const [currentMomentIndex, setCurrentMomentIndex] = useState(initialIndex ?? 0)
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0)
  const [progress, setProgress] = useState(0)   // 0–100, fill % for current media item
  const [paused, setPaused] = useState(false)
  const [infoVisible, setInfoVisible] = useState(true)
  const [showMenu, setShowMenu] = useState(false)

  const videoRef = useRef(null)
  const pointerStart = useRef(null)

  // One layout, not both with one hidden by CSS. The hidden copy still decoded
  // every photo a second time, played every clip a second time, and took
  // videoRef for itself, so pausing on mobile paused the invisible desktop clip.
  const isDesktop = useMediaQuery('(min-width: 48rem)')

  const moment = moments[currentMomentIndex]
  const mediaItems = useMemo(() => buildMediaItems(moment), [moment])
  const currentItem = mediaItems[currentMediaIndex]
  const isVideo = currentItem?.type === 'video'

  // The stage shows the thumbnail first and the original once the slide has
  // been looked at for a moment — CrossfadeImage has the full story. Keyed on
  // the URLs, not on currentItem: a Firestore re-emit rebuilds mediaItems, and
  // a new object identity must not look like a new slide.
  const currentUrl = currentItem?.url ?? ''
  const currentThumb = currentItem?.type === 'image' ? currentItem.thumbUrl : ''
  const currentTiny = currentItem?.type === 'image' ? currentItem.tinyPreview : ''

  // The clock starts when there is something to look at: the photo (not its
  // blur-up) on screen, or a video's first frame. A slow download used to eat
  // into the five seconds, and on a slow enough network the story moved on
  // before the photo had arrived at all.
  const [settledUrl, setSettledUrl] = useState('')
  const [videoReady, setVideoReady] = useState(false)
  const videoShown = isVideo && videoReady
  const imageSettled = !currentUrl || settledUrl === currentUrl

  // A slide change resets the clock, the pause and — on a new moment — the info
  // card, in the same render that shows the new slide. As effects they ran after
  // the browser had painted, so every switch showed one frame of the old
  // slide's progress (and a hidden info card) before snapping back.
  const slideKey = `${currentMomentIndex}:${currentMediaIndex}`
  const [renderedSlide, setRenderedSlide] = useState(slideKey)
  const [renderedClip, setRenderedClip] = useState(isVideo ? currentUrl : '')
  const [renderedMoment, setRenderedMoment] = useState(currentMomentIndex)

  // A clip being left stays up, paused on its last frame, until the next slide
  // has something on screen over it — the hold the stage gives a photo. Without
  // it, leaving a clip cut to the dark background while the next photo decoded.
  const [leavingClip, setLeavingClip] = useState(null) // { key, url }

  if (renderedSlide !== slideKey) {
    setRenderedSlide(slideKey)
    setRenderedClip(isVideo ? currentUrl : '')
    // Only a clip that had a frame is worth holding; coming straight back to
    // the one being left makes it the current clip again.
    if (renderedClip && videoReady) setLeavingClip({ key: renderedSlide, url: renderedClip })
    else if (leavingClip?.key === slideKey) setLeavingClip(null)
    setProgress(0)
    setPaused(false)
    // Every slide gets a new clip element (keyed on the slide), with no frame yet.
    setVideoReady(false)
  }
  if (!currentItem && leavingClip) setLeavingClip(null)
  if (renderedMoment !== currentMomentIndex) {
    setRenderedMoment(currentMomentIndex)
    setInfoVisible(true)
    setShowMenu(false)
  }

  const isFirstMedia = currentMediaIndex === 0
  const isLastMedia = currentMediaIndex === mediaItems.length - 1
  const isFirstMoment = currentMomentIndex === 0
  const isLastMoment = currentMomentIndex === moments.length - 1
  const isAtStart = isFirstMoment && isFirstMedia
  const isAtEnd = isLastMoment && isLastMedia

  // Stable refs let the keyboard listener + progress effect call the latest
  // goNext/goPrev/onClose without re-subscribing on every render.
  const goNextRef = useRef(null)
  const goPrevRef = useRef(null)
  const isAtEndRef = useRef(isAtEnd)
  const onCloseRef = useRef(onClose)

  const goNext = () => {
    if (!isLastMedia) {
      setCurrentMediaIndex((i) => i + 1)
    } else if (!isLastMoment) {
      // Update both indices in the same batch so the new moment never renders
      // with a stale media index (which would flash the empty placeholder).
      setCurrentMomentIndex((i) => i + 1)
      setCurrentMediaIndex(0)
    } else {
      onClose()
    }
  }

  const goPrev = () => {
    if (!isFirstMedia) {
      setCurrentMediaIndex((i) => i - 1)
    } else if (!isFirstMoment) {
      const prevMoment = moments[currentMomentIndex - 1]
      const prevItems = buildMediaItems(prevMoment)
      setCurrentMomentIndex((i) => i - 1)
      setCurrentMediaIndex(Math.max(0, prevItems.length - 1))
    }
  }

  // Jump straight to the next/previous moment, skipping any remaining media in
  // the current one. Used for horizontal swipe gestures.
  const goNextMoment = () => {
    if (!isLastMoment) {
      setCurrentMomentIndex((i) => i + 1)
      setCurrentMediaIndex(0)
    } else {
      onClose()
    }
  }

  const goPrevMoment = () => {
    if (!isFirstMoment) {
      setCurrentMomentIndex((i) => i - 1)
      setCurrentMediaIndex(0)
    }
  }

  // A horizontal swipe jumps between moments; a plain tap runs the per-zone
  // tapAction (step through the current moment's media). We track the pointer
  // start so pointerup can tell the two apart.
  const SWIPE_THRESHOLD = 50
  const handlePointerDown = (e) => {
    pointerStart.current = { x: e.clientX, y: e.clientY }
    // A press on the clip itself belongs to its own controls, which pause and
    // resume it on click. Pausing it here as well meant the release resumed it
    // and the click paused it again, so a clip once touched stayed paused.
    if (e.target instanceof HTMLVideoElement) return
    setPaused(true)
  }
  const handlePointerUp = (e, tapAction) => {
    setPaused(false)
    const start = pointerStart.current
    pointerStart.current = null
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNextMoment()
      else goPrevMoment()
    } else {
      tapAction?.()
    }
  }
  const handlePointerCancel = () => {
    setPaused(false)
    pointerStart.current = null
  }

  useEffect(() => {
    goNextRef.current = goNext
    goPrevRef.current = goPrev
    isAtEndRef.current = isAtEnd
    onCloseRef.current = onClose
  })

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Warm the decryption cache for what the next gesture reaches, so it can be
  // shown straight away. Only the neighbours: warming every photo left in the
  // moment put the one a tap actually lands on behind the rest of the batch.
  // In order of likelihood, since the prefetch lane is first come, first served.
  useEffect(() => {
    if (!encryptionKey) return
    const targets = [
      itemAtOffset(moments, currentMomentIndex, currentMediaIndex, 1), // tap forward
      itemAtOffset(moments, currentMomentIndex, currentMediaIndex, 2), // and the one after
      itemAtOffset(moments, currentMomentIndex, currentMediaIndex, -1), // tap back
      buildMediaItems(moments[currentMomentIndex + 1])[0], // swipe forward
      buildMediaItems(moments[currentMomentIndex - 1])[0], // swipe back
    ]
    const warmed = new Set()
    for (const item of targets) {
      if (!item?.url) continue
      // The thumbnail, not the original: it is what a slide opens on, and the
      // slide fetches its own original once it has been looked at.
      const url = item.type === 'video' ? item.url : item.thumbUrl || item.url
      if (warmed.has(url)) continue
      warmed.add(url)
      prefetchDecryptedMedia(url, encryptionKey, item.type === 'video' ? 'video/*' : 'image/*')
    }
  }, [currentMomentIndex, currentMediaIndex, encryptionKey, moments])

  // The next clip covers the one being left once it has faded in.
  useEffect(() => {
    if (!leavingClip || !videoShown) return
    const timer = setTimeout(() => setLeavingClip(null), FADE_MS + 50)
    return () => clearTimeout(timer)
  }, [leavingClip, videoShown])
  // …and the next photo, once the stage says it has.
  const dropLeavingClip = useCallback(() => setLeavingClip(null), [])

  // The clip being played gets videoRef. One taken back from being left already
  // has its frame, and no loadeddata is coming for it.
  const attachClip = useCallback((el) => {
    videoRef.current = el
    if (el && el.readyState >= 2) setVideoReady(true)
  }, [])
  const pauseClip = useCallback((el) => {
    el?.pause()
  }, [])

  // Auto-play video when current item is a video
  useEffect(() => {
    if (!isVideo) return
    const vid = videoRef.current
    if (!vid) return
    if (paused) {
      vid.pause()
    } else {
      vid.play().catch(() => {})
    }
  }, [isVideo, paused])

  // Auto-advance timer for images: 2% per 100ms = 5 000ms total
  useEffect(() => {
    if (paused || isVideo || !imageSettled) return
    const id = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 2
        return next >= 100 ? 100 : next
      })
    }, 100)
    return () => clearInterval(id)
  }, [paused, isVideo, imageSettled, currentMediaIndex, currentMomentIndex])

  // When image progress reaches 100, advance
  useEffect(() => {
    if (isVideo || progress < 100) return
    if (isAtEndRef.current) {
      onCloseRef.current()
    } else {
      goNextRef.current()
    }
  }, [progress, isVideo])

  // Keyboard navigation (registered once; delegates through refs to stay fresh)
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowRight') goNextRef.current?.()
      else if (e.key === 'ArrowLeft') goPrevRef.current?.()
      else if (e.key === 'Escape') onCloseRef.current?.()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const handleEdit = () => {
    setShowMenu(false)
    onEdit?.(moment)
    onClose()
  }

  const handleDelete = () => {
    setShowMenu(false)
    if (window.confirm(t('moment.deleteConfirm'))) {
      onDelete?.(moment.id)
      onClose()
    }
  }

  // Video event handlers
  const handleVideoTimeUpdate = (e) => {
    const { currentTime, duration } = e.target
    if (duration > 0) setProgress((currentTime / duration) * 100)
  }

  const handleVideoEnded = () => {
    if (isAtEndRef.current) {
      onCloseRef.current()
    } else {
      goNextRef.current()
    }
  }

  const authorName = moment?.authorName || t('moment.author')
  const authorInitials = useMemo(
    () => authorName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase(),
    [authorName]
  )

  if (!moment) return null

  // Progress bar segments — one per media item in the current moment.
  //
  // Elements, not components: a component defined in here is a new type on
  // every render, so React remounted both bars on every progress tick and the
  // width transition never had a previous width to animate from.
  const progressBarMobile = (
    <div className="flex gap-1 w-full">
      {mediaItems.map((_, i) => (
        <div key={i} className="h-0.5 flex-1 rounded-full bg-white/30 overflow-hidden">
          <div
            data-testid="progress-fill"
            className="h-full rounded-full bg-white"
            style={{
              width:
                i < currentMediaIndex ? '100%'
                : i === currentMediaIndex ? `${progress}%`
                : '0%',
              transition: paused ? 'none' : undefined,
            }}
          />
        </div>
      ))}
    </div>
  )

  const progressBarDesktop = (
    <div className="flex gap-1 w-full">
      {mediaItems.map((_, i) => (
        <div key={i} className="h-1 flex-1 rounded-full bg-cream-dark overflow-hidden">
          <div
            data-testid="progress-fill"
            className="h-full rounded-full bg-kaydo"
            style={{
              width:
                i < currentMediaIndex ? '100%'
                : i === currentMediaIndex ? `${progress}%`
                : '0%',
              transition: paused ? 'none' : undefined,
            }}
          />
        </div>
      ))}
    </div>
  )

  // The picture area, shared by both layouts: photos through the crossfade
  // stage, clips inside it. The clip being played sits above the stage's
  // photos, invisible until it has a frame while the stage holds the previous
  // picture underneath; a clip being left drops beneath them, frozen, for the
  // next photo to fade in over.
  const renderStage = (className, clipClassName) => {
    const clips = []
    if (leavingClip) {
      clips.push(
        <EncryptedVideo
          key={leavingClip.key}
          ref={pauseClip}
          src={leavingClip.url}
          muted
          playsInline
          controls={false}
          className={`${clipClassName} pointer-events-none`}
        />,
      )
    }
    if (isVideo) {
      clips.push(
        <EncryptedVideo
          key={slideKey}
          ref={attachClip}
          src={currentItem.url}
          autoPlay
          muted
          playsInline
          className={`${clipClassName} z-10 transition-opacity duration-200 ease-out motion-reduce:transition-none`}
          style={{ opacity: videoShown ? 1 : 0 }}
          onLoadedData={() => setVideoReady(true)}
          onTimeUpdate={handleVideoTimeUpdate}
          onEnded={handleVideoEnded}
        />,
      )
    }
    return (
      <CrossfadeImage
        src={isVideo ? '' : currentUrl}
        thumbSrc={isVideo ? '' : currentThumb}
        tinyPreview={isVideo ? '' : currentTiny}
        hold={isVideo && !videoShown}
        alt={moment.caption}
        className={className}
        onSettled={setSettledUrl}
        onShown={dropLeavingClip}
      >
        {clips}
      </CrossfadeImage>
    )
  }

  // ─── MOBILE: full-screen story ───
  if (!isDesktop) {
    return (
      <div
        className="fixed inset-0 z-50 bg-bark touch-none"
        onPointerDown={handlePointerDown}
        onPointerUp={(e) => handlePointerUp(e, null)}
        onPointerCancel={handlePointerCancel}
      >
        {/* Background media */}
        {renderStage('absolute inset-0 bg-bark', 'absolute inset-0 w-full h-full object-cover')}

        {/* Top gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent pointer-events-none" />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 px-4 pt-10 pb-2 z-20">
          {progressBarMobile}

          {/* User row */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2.5">
              <div className="story-ring">
                <div className="story-ring-inner">
                  <div className="w-8 h-8 rounded-full bg-kaydo flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{authorInitials}</span>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-tight">{authorName}</p>
                <p className="text-white/70 text-xs">{timeAgo(moment.date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v) }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="text-white/80 hover:text-white"
                    aria-label="More options"
                  >
                    <MoreHorizontal className="w-6 h-6" />
                  </button>
                  {showMenu && (
                    <div
                      className="absolute right-0 top-8 bg-white rounded-xl shadow-lg py-2 z-30 min-w-[140px]"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={handleEdit}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-bark hover:bg-cream-dark"
                      >
                        <Pencil className="w-4 h-4" /> Edit
                      </button>
                      <button
                        onClick={handleDelete}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
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
        </div>

        {/* Tap zones for navigation */}
        <button
          onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e) }}
          onPointerUp={(e) => { e.stopPropagation(); handlePointerUp(e, goPrev) }}
          onPointerCancel={(e) => { e.stopPropagation(); handlePointerCancel() }}
          disabled={isAtStart}
          className="absolute left-0 top-0 bottom-48 w-1/3 z-10 touch-none disabled:cursor-default"
          aria-label="Previous"
        />
        <button
          onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e) }}
          onPointerUp={(e) => { e.stopPropagation(); handlePointerUp(e, goNext) }}
          onPointerCancel={(e) => { e.stopPropagation(); handlePointerCancel() }}
          disabled={false}
          className="absolute right-0 top-0 bottom-48 w-1/3 z-10 touch-none disabled:cursor-default"
          aria-label="Next"
        />

        {/* Bottom info card — first media item only */}
        {currentMediaIndex === 0 && infoVisible && (
          <div className="absolute bottom-0 left-0 right-0 p-4 pb-8 z-20">
            <div className="relative bg-cream/70 backdrop-blur-sm rounded-3xl px-5 py-4 shadow-lg">
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
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── DESKTOP: centered card modal ───
  return (
    <div className="flex fixed inset-0 z-50 items-center justify-center">
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
          {progressBarDesktop}
        </div>

        {/* User info row */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-kaydo flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{authorInitials}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-bark leading-tight">{authorName}</p>
              <p className="text-xs text-bark-muted">{timeAgo(moment.date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu((v) => !v)}
                  className="text-bark-muted hover:text-bark p-1"
                  aria-label="More options"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-8 bg-white rounded-xl shadow-lg py-2 z-30 min-w-[140px]">
                    <button
                      onClick={handleEdit}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-bark hover:bg-cream-dark"
                    >
                      <Pencil className="w-4 h-4" /> Edit
                    </button>
                    <button
                      onClick={handleDelete}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={onClose}
              className="text-bark-muted hover:text-bark p-1"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Media — press to pause */}
        <div
          className="relative cursor-pointer select-none"
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
          onPointerCancel={() => setPaused(false)}
        >
          {renderStage(
            'relative w-full aspect-[4/5] bg-cream-dark',
            'absolute inset-0 w-full h-full object-cover pointer-events-none',
          )}
          {!currentItem && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-bark-muted text-sm">No media</span>
            </div>
          )}
        </div>

        {/* Caption pill — first media item only */}
        {currentMediaIndex === 0 && infoVisible && (moment.caption || moment.category || moment.location) && (
          <div className="mx-4 -mt-6 mb-4 relative z-10">
            <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-md">
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

      </div>

      {/* Right arrow */}
      <button
        onClick={goNext}
        disabled={false}
        className="relative z-10 ml-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        aria-label="Next"
      >
        <ChevronRight className="w-6 h-6" />
      </button>
    </div>
  )
}
