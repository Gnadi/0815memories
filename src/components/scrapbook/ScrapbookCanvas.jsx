import { useRef, useEffect, useState, forwardRef } from 'react'
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import CanvasElement from './CanvasElement'

const CANVAS_W = 800
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

export default forwardRef(function ScrapbookCanvas(
  { page, selectedId, onSelectElement, onUpdateElement, onDeleteElement, editable = true, exporting = false },
  ref
) {
  const containerRef = useRef(null)
  const [scale, setScale] = useState(1)

  // Compute scale so canvas fills available width
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return
      const available = containerRef.current.clientWidth
      setScale(Math.min(1, available / CANVAS_W))
    }
    update()
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 4 },
  })
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 100, tolerance: 8 },
  })
  const sensors = useSensors(pointerSensor, touchSensor)

  const handleDragEnd = ({ active, delta }) => {
    if (!active) return
    const el = page.elements.find((e) => e.id === active.id)
    if (!el) return
    // Photos with isSlot or with customize disabled do not move
    if (el.type === 'photo' && !editable) return
    onUpdateElement(active.id, {
      x: el.x + delta.x / scale,
      y: el.y + delta.y / scale,
    })
  }

  const background = page.backgroundColor || '#FDF6EC'
  const pattern = PATTERNS[page.backgroundPattern] || null
  const patternSize = PATTERN_SIZE[page.backgroundPattern] || null

  const canvasStyle = {
    width: CANVAS_W,
    height: CANVAS_H,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    background,
    ...(pattern ? { backgroundImage: pattern, backgroundSize: patternSize } : {}),
  }

  const sorted = [...(page.elements || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))

  return (
    <div ref={containerRef} className="w-full">
      {/* Outer container sized by scaled canvas */}
      <div style={{ height: CANVAS_H * scale, position: 'relative' }}>
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div
            ref={ref}
            style={{
              ...canvasStyle,
              position: 'relative',
              overflow: 'hidden',
              border: '2px solid var(--color-bark)',
              boxSizing: 'border-box',
            }}
            onClick={() => onSelectElement(null)}
          >
            {sorted.map((el) => (
              <CanvasElement
                key={el.id}
                element={el}
                isSelected={selectedId === el.id}
                onSelect={onSelectElement}
                onUpdate={onUpdateElement}
                onDelete={onDeleteElement}
                canvasScale={scale}
                editable={editable}
                exporting={exporting}
              />
            ))}
          </div>
        </DndContext>
      </div>
    </div>
  )
})
