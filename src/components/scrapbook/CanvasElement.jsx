import { useRef, useState, useCallback } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Trash2, RotateCw, ImagePlus, ArrowLeftRight } from 'lucide-react'
import EncryptedImage from '../media/EncryptedImage'

const HANDLE_SIZE = 10

export default function CanvasElement({
  element,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  canvasScale,
  swapSourceId,
  onSwapTarget,
}) {
  const { id, type, x, y, width, height, rotation = 0, zIndex = 0 } = element
  const elementRef = useRef(null)
  const [isEditing, setIsEditing] = useState(false)
  const resizeRef = useRef(null)
  const rotateRef = useRef(null)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })

  const currentX = x + (transform?.x ?? 0) / canvasScale
  const currentY = y + (transform?.y ?? 0) / canvasScale

  // Resize with pointer events
  const handleResizePointerDown = useCallback((e, corner) => {
    e.stopPropagation()
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const startW = width
    const startH = height
    const startEX = x
    const startEY = y

    const onMove = (me) => {
      const dx = (me.clientX - startX) / canvasScale
      const dy = (me.clientY - startY) / canvasScale
      let newW = startW, newH = startH, newX = startEX, newY = startEY

      if (corner === 'se') {
        newW = Math.max(60, startW + dx)
        newH = Math.max(40, startH + dy)
      } else if (corner === 'sw') {
        newW = Math.max(60, startW - dx)
        newH = Math.max(40, startH + dy)
        newX = startEX + (startW - newW)
      } else if (corner === 'ne') {
        newW = Math.max(60, startW + dx)
        newH = Math.max(40, startH - dy)
        newY = startEY + (startH - newH)
      } else if (corner === 'nw') {
        newW = Math.max(60, startW - dx)
        newH = Math.max(40, startH - dy)
        newX = startEX + (startW - newW)
        newY = startEY + (startH - newH)
      }

      onUpdate(id, { width: newW, height: newH, x: newX, y: newY })
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [id, x, y, width, height, canvasScale, onUpdate])

  // Rotate with pointer events
  const handleRotatePointerDown = useCallback((e) => {
    e.stopPropagation()
    e.preventDefault()
    const rect = elementRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2

    const onMove = (me) => {
      const angle = Math.atan2(me.clientY - cy, me.clientX - cx) * (180 / Math.PI) + 90
      onUpdate(id, { rotation: Math.round(angle) })
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [id, onUpdate])

  const handleDoubleClick = (e) => {
    if (type === 'text') {
      e.stopPropagation()
      setIsEditing(true)
    }
  }

  const handleTextBlur = (e) => {
    setIsEditing(false)
    onUpdate(id, { text: e.target.value })
  }

  const handleTextKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }

  const renderContent = () => {
    if (type === 'photo') {
      // Empty layout slot — render "Tap to add photo" placeholder.
      if (!element.url) {
        return (
          <div
            onClick={(e) => {
              e.stopPropagation()
              onSelect?.(id)
            }}
            className="w-full h-full flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-bark-muted/60 bg-bark-muted/20 text-bark-light hover:bg-bark-muted/30 hover:border-kaydo/70 hover:text-kaydo transition-colors cursor-pointer"
          >
            <ImagePlus className="w-12 h-12" />
            <span className="text-lg font-semibold leading-tight text-center px-3">
              Tap to add photo
            </span>
          </div>
        )
      }

      const isPolaroid = element.polaroid
      const flipStyle = element.flipped ? { transform: 'scaleX(-1)' } : undefined
      return (
        <div className={`w-full h-full ${isPolaroid ? 'bg-white p-2 pb-6 shadow-md' : ''} flex flex-col relative`}>
          <EncryptedImage
            src={element.url}
            alt=""
            crossOrigin="anonymous"
            className={`flex-1 w-full object-cover ${isPolaroid ? '' : 'rounded'}`}
            draggable={false}
            style={flipStyle}
          />
          {isPolaroid && element.caption && (
            <p className="text-center text-xs font-serif text-bark-muted mt-1 truncate px-1">
              {element.caption}
            </p>
          )}
          {/* Swap-target hint overlay */}
          {swapSourceId && swapSourceId !== id && (
            <div className="absolute inset-0 bg-kaydo/40 border-4 border-kaydo rounded flex flex-col items-center justify-center pointer-events-none">
              <ArrowLeftRight className="w-10 h-10 text-white drop-shadow" />
              <span className="text-white text-sm font-bold drop-shadow mt-1">Swap here</span>
            </div>
          )}
        </div>
      )
    }

    if (type === 'text') {
      const fontMap = { serif: 'Georgia, serif', sans: 'system-ui, sans-serif', mono: 'monospace' }
      const style = {
        fontSize: element.fontSize || 20,
        color: element.color || '#2D1B0E',
        fontFamily: fontMap[element.fontFamily] || fontMap.serif,
        fontWeight: element.fontWeight || 'normal',
        textAlign: element.textAlign || 'center',
        lineHeight: 1.3,
      }

      if (isEditing) {
        return (
          <textarea
            autoFocus
            defaultValue={element.text || ''}
            onBlur={handleTextBlur}
            onKeyDown={handleTextKeyDown}
            className="w-full h-full resize-none bg-transparent outline-none border-none p-0"
            style={style}
            onClick={(e) => e.stopPropagation()}
          />
        )
      }

      return (
        <div
          className="w-full h-full overflow-hidden flex items-center justify-center"
          style={style}
          onDoubleClick={handleDoubleClick}
        >
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {element.text || 'Double-click to edit'}
          </span>
        </div>
      )
    }

    if (type === 'sticker') {
      return (
        <div className="w-full h-full flex items-center justify-center select-none" style={{ fontSize: element.stickerSize || 48 }}>
          {element.emoji}
        </div>
      )
    }

    return null
  }

  const translateX = isDragging ? currentX : x
  const translateY = isDragging ? currentY : y

  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        elementRef.current = node
      }}
      style={{
        position: 'absolute',
        left: translateX,
        top: translateY,
        width,
        height,
        transform: `rotate(${rotation}deg)`,
        zIndex: isSelected ? 1000 : zIndex,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
        opacity: isDragging ? 0.85 : 1,
      }}
      onClick={(e) => {
        e.stopPropagation()
        // Swap mode: tapping a different filled photo swaps with the source.
        if (swapSourceId && swapSourceId !== id && type === 'photo' && element.url) {
          onSwapTarget?.(id)
          return
        }
        onSelect(id)
      }}
      {...(isEditing ? {} : { ...listeners, ...attributes })}
    >
      {/* Element content */}
      <div className="w-full h-full">
        {renderContent()}
      </div>

      {/* Selection ring + handles */}
      {isSelected && !isDragging && (
        <>
          <div className="absolute inset-0 border-2 border-blue-400 pointer-events-none rounded" />

          {/* Delete button */}
          <button
            onPointerDown={(e) => { e.stopPropagation(); onDelete(id) }}
            className="absolute -top-3 -left-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow z-10 hover:bg-red-600"
            style={{ touchAction: 'manipulation' }}
          >
            <Trash2 className="w-3 h-3" />
          </button>

          {/* Rotate handle */}
          <div
            onPointerDown={handleRotatePointerDown}
            className="absolute -top-7 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border-2 border-blue-400 rounded-full flex items-center justify-center cursor-grab shadow z-10"
            style={{ touchAction: 'none' }}
          >
            <RotateCw className="w-3 h-3 text-blue-500" />
          </div>

          {/* Resize corners */}
          {[
            { corner: 'nw', style: { top: -HANDLE_SIZE/2, left: -HANDLE_SIZE/2, cursor: 'nw-resize' } },
            { corner: 'ne', style: { top: -HANDLE_SIZE/2, right: -HANDLE_SIZE/2, cursor: 'ne-resize' } },
            { corner: 'sw', style: { bottom: -HANDLE_SIZE/2, left: -HANDLE_SIZE/2, cursor: 'sw-resize' } },
            { corner: 'se', style: { bottom: -HANDLE_SIZE/2, right: -HANDLE_SIZE/2, cursor: 'se-resize' } },
          ].map(({ corner, style }) => (
            <div
              key={corner}
              onPointerDown={(e) => handleResizePointerDown(e, corner)}
              className="absolute w-[10px] h-[10px] bg-white border-2 border-blue-400 rounded-sm z-10"
              style={{ ...style, touchAction: 'none' }}
            />
          ))}
        </>
      )}
    </div>
  )
}
