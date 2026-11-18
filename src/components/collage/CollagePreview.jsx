import { useEffect, useRef, useState } from 'react'
import { ASPECTS, DEFAULT_ASPECT, getTemplate } from './collageTemplates'
import { drawCollage } from '../../utils/collageRenderer'
import { useCollageImages } from '../../hooks/useCollageImages'

/**
 * A collage drawn onto a <canvas>, sized to whatever box it is given.
 *
 * Gallery cards, the template strip and the editor all render through this, so
 * a customer never sees a preview that differs from the exported file — the
 * pixels come from the same `drawCollage` call.
 */
export default function CollagePreview({
  doc,
  className = '',
  style,
  placeholders = true,
  preferThumbs = false,
  // 'width' sets the box's own aspect ratio from the collage — right for cards
  // in a grid. 'box' fills whatever the parent already sized, which is how the
  // editor fits the collage to the space left between its toolbars.
  fit = 'width',
  // Load and draw only once the box comes near the screen. The gallery and the
  // template strip drew every collage at once, off-screen ones included: 17
  // canvases and 115–320 ms of drawing on a throttled phone, on every visit.
  lazy = false,
  onCanvas,
}) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [shown, setShown] = useState(!lazy)
  const images = useCollageImages(shown ? doc : null, { preferThumbs })

  useEffect(() => {
    if (shown) return
    const node = wrapRef.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setShown(true)
        observer.disconnect()
      }
    }, { rootMargin: '300px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [shown])

  const template = getTemplate(doc?.templateId)
  const ratio = ASPECTS[doc?.aspect || template.aspect] ?? ASPECTS[DEFAULT_ASPECT]

  useEffect(() => {
    const node = wrapRef.current
    if (!node) return
    const update = () => setSize({ width: node.clientWidth, height: node.clientHeight })
    update()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(update)
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !size.width || !shown) return
    // One drawing per frame, however many changes land in it (a resize and the
    // photos arriving, say).
    const frame = requestAnimationFrame(() => {
      // Cap the backing store: a retina phone rendering a full-width collage at
      // 3× is a lot of pixels for a preview nobody exports from.
      const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2)
      const cssHeight = fit === 'box' && size.height ? size.height : size.width / ratio
      const width = Math.round(size.width * dpr)
      const height = Math.round(cssHeight * dpr)
      // Setting either allocates a new backing store, even to the same value;
      // drawCollage clears the canvas itself.
      if (canvas.width !== width) canvas.width = width
      if (canvas.height !== height) canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      drawCollage(ctx, doc, images, { width, height, placeholders })
      onCanvas?.(canvas)
    })
    return () => cancelAnimationFrame(frame)
  }, [doc, images, size, ratio, placeholders, fit, onCanvas, shown])

  return (
    <div
      ref={wrapRef}
      className={className}
      style={fit === 'box' ? style : { aspectRatio: String(ratio), ...style }}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  )
}
