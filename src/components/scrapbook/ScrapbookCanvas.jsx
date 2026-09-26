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

/**
 * `printFrame` ({ width, height, offsetX, offsetY }, from utils/printBook) lays
 * the page out as it will be printed: the canvas takes the print format's
 * shape, the page's background fills all of it, and the elements sit in an
 * 800 × 600 box at the offset. The editor's border is dropped — on paper it
 * would be a dark line around every page. `exportRatio` is the backing-store
 * ratio of the export canvases, which must match the capture's scale.
 */
export default forwardRef(function ScrapbookCanvas(
  {
    page, selectedId, onSelectElement, onUpdateElement, onDeleteElement,
    editable = true, exporting = false, cropping = false, exportRatio, printFrame = null,
  },
  ref
) {
  const containerRef = useRef(null)
  const [scale, setScale] = useState(1)

  // Compute scale so canvas fits the available space, respecting both width
  // AND height so the whole editor fits on screen without scrolling.
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return
      const w = containerRef.current.clientWidth
      const h = containerRef.current.clientHeight
      const byW = w > 0 ? w / CANVAS_W : 1
      const byH = h > 0 ? h / CANVAS_H : 1
      setScale(Math.min(1, byW, byH))
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
    width: printFrame ? printFrame.width : CANVAS_W,
    height: printFrame ? printFrame.height : CANVAS_H,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    background,
    // Positioned at the page box, so the pattern lines up with the elements
    // exactly as it does in the editor while it runs on into the margins.
    ...(pattern ? {
      backgroundImage: pattern,
      backgroundSize: patternSize,
      ...(printFrame ? { backgroundPosition: `${printFrame.offsetX}px ${printFrame.offsetY}px` } : {}),
    } : {}),
  }

  // The box the elements are positioned in and clipped to: the whole canvas in
  // the editor, the page's own 800 × 600 inside a print frame.
  const pageBoxStyle = printFrame
    ? { position: 'absolute', left: printFrame.offsetX, top: printFrame.offsetY, width: CANVAS_W, height: CANVAS_H, overflow: 'hidden' }
    : { position: 'absolute', inset: 0, overflow: 'hidden' }

  const sorted = [...(page.elements || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center">
      {/* Wrapper sized to the scaled canvas dimensions so the scaled content
          keeps its layout footprint (transform doesn't affect layout). */}
      <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, position: 'relative', boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)' }}>
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div
            ref={ref}
            style={{
              ...canvasStyle,
              position: 'relative',
              overflow: 'hidden',
              border: printFrame ? 'none' : '2px solid var(--color-bark)',
              boxSizing: 'border-box',
            }}
            onClick={() => onSelectElement(null)}
          >
            <div style={pageBoxStyle}>
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
                  exportRatio={exportRatio}
                  cropping={cropping && selectedId === el.id}
                />
              ))}
            </div>
          </div>
        </DndContext>
      </div>
    </div>
  )
})
