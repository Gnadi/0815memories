import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import CanvasElement from './CanvasElement'

const CANVAS_W = 800
const CANVAS_H = 600
const SPREAD_W = CANVAS_W * 2

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

// ─── Single page (one side of the spread) ─────────────────────────────────────
const SinglePage = forwardRef(function SinglePage(
  {
    page,
    pageIndex,
    canvasScale,
    isActive,
    onActivate,
    selectedId,
    onSelectElement,
    onUpdateElement,
    onDeleteElement,
    onSlotClick,
    uploadingSlotId,
  },
  ref
) {
  // Blank/placeholder side (cover's right page or odd-tail right page)
  if (page == null || pageIndex == null) {
    return (
      <div
        ref={ref}
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          position: 'relative',
          overflow: 'hidden',
          background:
            'repeating-linear-gradient(45deg, #F5E6D0, #F5E6D0 10px, #FDF6EC 10px, #FDF6EC 20px)',
          opacity: 0.55,
        }}
        className="flex items-center justify-center select-none"
      >
        <span className="text-bark-muted text-sm font-medium">No page</span>
      </div>
    )
  }

  const background = page.backgroundColor || '#FDF6EC'
  const pattern = PATTERNS[page.backgroundPattern] || null
  const patternSize = PATTERN_SIZE[page.backgroundPattern] || null

  const sorted = [...(page.elements || [])].sort(
    (a, b) => (a.zIndex || 0) - (b.zIndex || 0)
  )

  return (
    <div
      ref={ref}
      style={{
        width: CANVAS_W,
        height: CANVAS_H,
        position: 'relative',
        overflow: 'hidden',
        background,
        ...(pattern ? { backgroundImage: pattern, backgroundSize: patternSize } : {}),
        outline: isActive ? '3px solid #C25A2E' : '1px solid rgba(45,27,14,0.08)',
        outlineOffset: '-3px',
        transition: 'outline-color 150ms ease',
      }}
      onClick={() => {
        onActivate?.()
        onSelectElement?.(pageIndex, null)
      }}
    >
      {sorted.map((el) => (
        <CanvasElement
          key={el.id}
          element={el}
          isSelected={selectedId === el.id}
          onSelect={(id) => onSelectElement?.(pageIndex, id)}
          onUpdate={(id, updates) => onUpdateElement?.(pageIndex, id, updates)}
          onDelete={(id) => onDeleteElement?.(pageIndex, id)}
          onSlotClick={(id) => onSlotClick?.(pageIndex, id)}
          isUploading={uploadingSlotId === el.id}
          canvasScale={canvasScale}
        />
      ))}
    </div>
  )
})

// ─── Two-page spread ──────────────────────────────────────────────────────────
export default forwardRef(function ScrapbookCanvas(
  {
    leftPage,
    rightPage,
    leftPageIndex,
    rightPageIndex,
    activeSide,
    onActivate,
    selectedId,
    onSelectElement,
    onUpdateElement,
    onDeleteElement,
    onSlotClick,
    uploadingSlotId,
  },
  ref
) {
  const containerRef = useRef(null)
  const leftCanvasRef = useRef(null)
  const rightCanvasRef = useRef(null)
  const [scale, setScale] = useState(1)

  // Compute scale so the full spread fills available width
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return
      const available = containerRef.current.clientWidth
      setScale(Math.min(1, available / SPREAD_W))
    }
    update()
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Expose per-page DOM refs for PDF export
  useImperativeHandle(
    ref,
    () => ({
      getPageNode: (side) => (side === 'right' ? rightCanvasRef.current : leftCanvasRef.current),
      getActiveNode: () =>
        activeSide === 'right' ? rightCanvasRef.current : leftCanvasRef.current,
    }),
    [activeSide]
  )

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 4 },
  })
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 100, tolerance: 8 },
  })
  const sensors = useSensors(pointerSensor, touchSensor)

  const handleDragEnd = ({ active, delta }) => {
    if (!active) return
    // Find which side of the spread owns this element
    const onLeft = leftPage?.elements?.some((e) => e.id === active.id)
    const page = onLeft ? leftPage : rightPage
    const pageIndex = onLeft ? leftPageIndex : rightPageIndex
    if (page == null || pageIndex == null) return
    const el = page.elements.find((e) => e.id === active.id)
    if (!el) return
    onUpdateElement?.(pageIndex, active.id, {
      x: el.x + delta.x / scale,
      y: el.y + delta.y / scale,
    })
  }

  return (
    <div ref={containerRef} className="w-full">
      <div
        style={{
          width: '100%',
          height: CANVAS_H * scale,
          position: 'relative',
        }}
      >
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div
            style={{
              width: SPREAD_W,
              height: CANVAS_H,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              display: 'flex',
              position: 'relative',
              boxShadow:
                '0 25px 50px -12px rgba(0,0,0,0.35), 0 0 0 4px #2D1B0E',
              borderRadius: 4,
            }}
          >
            <SinglePage
              ref={leftCanvasRef}
              page={leftPage}
              pageIndex={leftPageIndex}
              canvasScale={scale}
              isActive={activeSide === 'left' && leftPage != null}
              onActivate={() => leftPage != null && onActivate?.('left')}
              selectedId={selectedId}
              onSelectElement={onSelectElement}
              onUpdateElement={onUpdateElement}
              onDeleteElement={onDeleteElement}
              onSlotClick={onSlotClick}
              uploadingSlotId={uploadingSlotId}
            />

            {/* Spine / gutter shadow overlay straddling the seam */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: CANVAS_W - 18,
                width: 36,
                background:
                  'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0) 100%)',
                pointerEvents: 'none',
                zIndex: 20,
              }}
            />

            <SinglePage
              ref={rightCanvasRef}
              page={rightPage}
              pageIndex={rightPageIndex}
              canvasScale={scale}
              isActive={activeSide === 'right' && rightPage != null}
              onActivate={() => rightPage != null && onActivate?.('right')}
              selectedId={selectedId}
              onSelectElement={onSelectElement}
              onUpdateElement={onUpdateElement}
              onDeleteElement={onDeleteElement}
              onSlotClick={onSlotClick}
              uploadingSlotId={uploadingSlotId}
            />
          </div>
        </DndContext>
      </div>
    </div>
  )
})
