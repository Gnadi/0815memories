import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import CanvasElement from './CanvasElement'

const CANVAS_W = 600
const CANVAS_H = 900

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
  const [scale, setScale] = useState(1)

  // Fit the page within both width and height of the container.
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return
      const w = containerRef.current.clientWidth
      const h = containerRef.current.clientHeight
      const widthScale = w > 0 ? w / CANVAS_W : 1
      const heightScale = h > 0 ? h / CANVAS_H : 1
      const next = Math.min(1, widthScale, heightScale)
      setScale(next > 0 ? next : 1)
    }
    update()
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
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
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: CANVAS_W * scale,
          height: CANVAS_H * scale,
          transform: 'translate(-50%, -50%)',
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
              position: 'relative',
              overflow: 'hidden',
              background,
              ...(pattern ? { backgroundImage: pattern, backgroundSize: patternSize } : {}),
              boxShadow:
                '0 25px 50px -12px rgba(0,0,0,0.35), 0 0 0 4px #2D1B0E',
              borderRadius: 4,
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
