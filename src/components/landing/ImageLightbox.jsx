import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

/**
 * Click-to-enlarge for the landing page's screenshots. The pictures sit in
 * cards at roughly a third of their size, which is too small to read the app's
 * text, so on a desktop a click opens them in a gallery: one big picture, with
 * the others of the page a key press away.
 *
 * The list is read from the page when the gallery opens (every `ZoomTarget`,
 * in page order) rather than registered by each picture, so the pictures
 * stay plain markup for the pre-render, and nothing here runs before a click.
 */

const LightboxContext = createContext(null)

// Below this width a picture is already as wide as the screen; a gallery
// would only add a step.
const DESKTOP_QUERY = '(min-width: 768px)'

// Renders the page's root element itself, so that wrapping the page in it does
// not re-indent the page.
export function LightboxProvider({ labels, className, children }) {
  const [gallery, setGallery] = useState(null)
  const opener = useRef(null)

  const open = useCallback((element) => {
    if (!window.matchMedia(DESKTOP_QUERY).matches) return
    const targets = [...document.querySelectorAll('[data-zoom-src]')]
    const index = targets.indexOf(element)
    if (index === -1) return
    opener.current = element
    setGallery({
      index,
      items: targets.map((el) => ({ src: el.dataset.zoomSrc, alt: el.dataset.zoomAlt })),
    })
  }, [])

  const close = useCallback(() => {
    setGallery(null)
    // Give focus back to the picture that was clicked, so a keyboard user
    // continues where they were instead of at the top of the page.
    opener.current?.focus()
  }, [])

  const step = useCallback((by) => {
    setGallery((g) => g && { ...g, index: (g.index + by + g.items.length) % g.items.length })
  }, [])

  return (
    <LightboxContext.Provider value={open}>
      <div className={className}>{children}</div>
      {gallery && createPortal(
        <Gallery gallery={gallery} labels={labels} onClose={close} onStep={step} />,
        document.body,
      )}
    </LightboxContext.Provider>
  )
}

/**
 * Wraps a screenshot so a click enlarges it. Outside a LightboxProvider (the
 * feature pages) it renders the picture as it is.
 */
export function ZoomTarget({ src, alt, className = '', children }) {
  const open = useContext(LightboxContext)
  if (!open) return children
  return (
    <button
      type="button"
      data-zoom-src={src}
      data-zoom-alt={alt}
      onClick={(e) => open(e.currentTarget)}
      className={`md:cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kaydo ${className}`}
    >
      {children}
    </button>
  )
}

function Gallery({ gallery, labels, onClose, onStep }) {
  const { items, index } = gallery
  const item = items[index]
  const closeRef = useRef(null)
  const many = items.length > 1

  useEffect(() => {
    closeRef.current?.focus()
    // The page behind must not scroll while the gallery is up.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') onStep(-1)
      else if (e.key === 'ArrowRight') onStep(1)
      else if (e.key === 'Tab') {
        // Only the three buttons are reachable; keep focus among them.
        const buttons = [...document.querySelectorAll('[data-lightbox-button]')]
        const at = buttons.indexOf(document.activeElement)
        const next = (at + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length
        buttons[next].focus()
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onStep])

  const round = 'absolute z-10 w-11 h-11 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-white'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.alt}
      className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-6"
      // A click on the dark backdrop closes it; one on the picture does not.
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <button ref={closeRef} data-lightbox-button type="button" onClick={onClose} aria-label={labels.close} className={`${round} top-5 right-5`}>
        <X className="w-5 h-5" />
      </button>
      {many && (
        <>
          <button data-lightbox-button type="button" onClick={() => onStep(-1)} aria-label={labels.previous} className={`${round} left-5 top-1/2 -translate-y-1/2`}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button data-lightbox-button type="button" onClick={() => onStep(1)} aria-label={labels.next} className={`${round} right-5 top-1/2 -translate-y-1/2`}>
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}
      <figure className="flex flex-col items-center gap-3 max-w-full">
        <img
          key={item.src}
          src={item.src}
          alt={item.alt}
          className="max-w-[calc(100vw-9rem)] max-h-[calc(100vh-7rem)] w-auto h-auto rounded-xl shadow-2xl bg-white"
        />
        <figcaption className="text-sm text-white/80 text-center max-w-2xl">
          {item.alt}
          {many && <span className="ml-2 text-white/60">{index + 1} / {items.length}</span>}
        </figcaption>
      </figure>
    </div>
  )
}
