import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import CanvasElement from './CanvasElement'

const CANVAS_W = 900
const CANVAS_H = 600

const PATTERNS = {
  none: null,
  dots: 'radial-gradient(circle, #c8b9a8 1px, transparent 1px)',
  grid: 'linear-gradient(#ddd 1px, transparent 1px), linear-gradient(90deg, #ddd 1px, transparent 1px)',
  lines: 'repeating-linear-gradient(0deg, transparent, transparent 23px, #ddd 24px)',
}

const PATTERN_SIZE = {
  none: null,
  dots: '20px 20px',
  grid: '40px 40px',
  lines: '100% 24px',
}

// Single-page editable scrapbook canvas. The page is rendered at its native
// 600×900 resolution and uniformly scaled to fit the parent container.
export default forwardRef(function ScrapbookCanvas(
  {
    page,
    pageIndex,
    selectedId,
    onSelectElement,
    onUpdateElement,
    onDeleteElement,
    swapSourceId,
    onSwapTarget,
  },
  ref
) {
  const containerRef = useRef(null)
  const pageRef = useRef(null)
  // Start at 0 so we never render an oversize book before we've measured the
  // container (otherwise a 600×900 page flashes past the viewport on mobile).
  const [scale, setScale] = useState(0)

  // Fit the page within both width and height of the container.
  useEffect(() => {
    const update = () => {
      const node = containerRef.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const next = Math.min(1, rect.width / CANVAS_W, rect.height / CANVAS_H)
      if (next > 0) setScale(next)
    }
    // Defer initial measurement until after layout has settled — on first
    // paint the flex parent can report 0 width/height.
    const rafId = requestAnimationFrame(update)
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [])

  // Expose the page DOM node for PDF export
  useImperativeHandle(
    ref,
    () => ({
      getPageNode: () => pageRef.current,
    }),
    []
  )

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 4 },
  })
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 100, tolerance: 8 },
  })
  const sensors = useSensors(pointerSensor, touchSensor)

  const handleDragEnd = ({ active, delta }) => {
    if (!active || page == null || pageIndex == null) return
    const el = page.elements?.find((e) => e.id === active.id)
    if (!el) return
    onUpdateElement?.(pageIndex, active.id, {
      x: el.x + delta.x / scale,
      y: el.y + delta.y / scale,
    })
  }

  if (page == null) {
    return <div ref={containerRef} className="relative w-full h-full overflow-hidden" />
  }

  const background = page.backgroundColor || '#FDF6EC'
  const pattern = PATTERNS[page.backgroundPattern] || null
  const patternSize = PATTERN_SIZE[page.backgroundPattern] || null

  const sorted = [...(page.elements || [])].sort(
    (a, b) => (a.zIndex || 0) - (b.zIndex || 0)
  )

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden flex items-center justify-center"
    >
      <div
        style={{
          width: CANVAS_W * scale,
          height: CANVAS_H * scale,
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div
            ref={pageRef}
            style={{
              width: CANVAS_W,
              height: CANVAS_H,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              position: 'absolute',
              top: 0,
              left: 0,
              overflow: 'hidden',
              background,
              ...(pattern ? { backgroundImage: pattern, backgroundSize: patternSize } : {}),
              boxShadow: '0 10px 30px -10px rgba(0,0,0,0.20)',
              borderRadius: 8,
            }}
            onClick={() => onSelectElement?.(pageIndex, null)}
          >
            {sorted.map((el) => (
              <CanvasElement
                key={el.id}
                element={el}
                isSelected={selectedId === el.id}
                onSelect={(id) => onSelectElement?.(pageIndex, id)}
                onUpdate={(id, updates) => onUpdateElement?.(pageIndex, id, updates)}
                onDelete={(id) => onDeleteElement?.(pageIndex, id)}
                canvasScale={scale}
                swapSourceId={swapSourceId}
                onSwapTarget={onSwapTarget}
              />
            ))}
          </div>
        </DndContext>
      </div>
    </div>
  )
})
