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
  onCanvas,
}) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const images = useCollageImages(doc, { preferThumbs })

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
    if (!canvas || !size.width) return
    // Cap the backing store: a retina phone rendering a full-width collage at
    // 3× is a lot of pixels for a preview nobody exports from.
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2)
    const cssHeight = fit === 'box' && size.height ? size.height : size.width / ratio
    const width = Math.round(size.width * dpr)
    const height = Math.round(cssHeight * dpr)
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawCollage(ctx, doc, images, { width, height, placeholders })
    onCanvas?.(canvas)
  }, [doc, images, size, ratio, placeholders, fit, onCanvas])

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
