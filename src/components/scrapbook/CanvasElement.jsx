import { useRef, useState, useCallback, useEffect } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Trash2, RotateCw, ImagePlus, ChevronsUp } from 'lucide-react'
import EncryptedImage from '../media/EncryptedImage'
import useDecryptedMedia from '../media/useDecryptedMedia'

const HANDLE_SIZE = 10

// Draw an image onto a canvas exactly as the editor shows it:
// object-cover behaviour (fill container, crop to centre) + imageScale zoom.
// This bypasses html2canvas's broken overflow:hidden handling entirely.
function drawImageCoveredAndScaled(ctx, img, w, h, imageScale, flipped) {
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  if (!iw || !ih) return

  // --- object-cover: find the source rect that fills w×h ---
  let coverW, coverH
  if (iw / ih > w / h) {
    // image wider than container: fit height, crop sides
    coverH = ih
    coverW = (w / h) * ih
  } else {
    // image taller than container: fit width, crop top/bottom
    coverW = iw
    coverH = (h / w) * iw
  }
  const coverX = (iw - coverW) / 2
  const coverY = (ih - coverH) / 2

  // --- imageScale zoom: show centre 1/imageScale of the covered area ---
  const srcW = coverW / imageScale
  const srcH = coverH / imageScale
  const srcX = coverX + (coverW - srcW) / 2
  const srcY = coverY + (coverH - srcH) / 2

  if (flipped) {
    ctx.save()
    ctx.translate(w, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, w, h)
    ctx.restore()
  } else {
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, w, h)
  }
}

export default function CanvasElement({
  element,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  canvasScale,
  editable = true,
  exporting = false,
}) {
  const { id, type, x, y, width, height, rotation = 0, zIndex = 0 } = element
  const elementRef = useRef(null)
  const exportCanvasRef = useRef(null)
  const [isEditing, setIsEditing] = useState(false)

  // Always decrypt the image URL so it's warm in the cache before export starts.
  // (EncryptedImage does the same internally; the shared cache avoids double-fetching.)
  const { decryptedUrl } = useDecryptedMedia(
    type === 'photo' ? element.url : null,
    'image/*'
  )

  // When exporting, draw the correctly-cropped image onto the canvas element.
  // html2canvas reads <canvas> pixel data directly, so no overflow/clip tricks needed.
  useEffect(() => {
    if (!exporting || type !== 'photo' || !exportCanvasRef.current || !decryptedUrl) return
    const canvas = exportCanvasRef.current
    const cw = canvas.offsetWidth || width
    const ch = canvas.offsetHeight || height
    if (!cw || !ch) return
    canvas.width = cw
    canvas.height = ch
    const imageScale = element.imageScale || 1
    const flipped = !!element.flipped
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => drawImageCoveredAndScaled(ctx, img, cw, ch, imageScale, flipped)
    img.src = decryptedUrl
  }, [exporting, type, decryptedUrl, element.imageScale, element.flipped, width, height])

  // Photos are "slots" when they have no url yet. Slots are always selectable
  // (so users can fill them via the PhotoBar) but are never draggable/resizable
  // unless the page has been put into "customize" mode.
  const isEmptySlot = type === 'photo' && !element.url

  // When `editable` is false (fixed layout) and this is a photo, freeze
  // position/size. Text and stickers remain free-form regardless.
  const allowDrag = editable || type !== 'photo'
  const allowResize = editable || type !== 'photo'

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled: !allowDrag })

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
      // Empty slot: placeholder with "Tap to add photo"
      if (isEmptySlot) {
        if (exporting) return <div className="w-full h-full" />
        return (
          <div
            className={`w-full h-full flex items-center justify-center select-none transition-colors ${
              isSelected
                ? 'bg-kaydo/10 border-2 border-kaydo'
                : 'bg-bark-muted/20 border-2 border-dashed border-bark-muted/60 hover:border-kaydo'
            }`}
            style={{ borderRadius: 6 }}
          >
            <div className="flex flex-col items-center gap-1 text-center px-2">
              <ImagePlus className="w-6 h-6 text-bark-muted" />
              <span className="text-[11px] font-medium text-bark-light leading-tight">
                Tap to add photo
              </span>
            </div>
          </div>
        )
      }

      const isPolaroid = element.polaroid
      const imageScale = element.imageScale || 1
      const flipped = !!element.flipped

      if (exporting) {
        // During PDF export, render onto a <canvas> element using Canvas 2D API.
        // html2canvas reads canvas pixels verbatim, completely bypassing the
        // overflow:hidden + transform clipping issues that plague <img> elements.
        return (
          <div className={`w-full h-full ${isPolaroid ? 'bg-white p-2 pb-6 shadow-md' : ''} flex flex-col`}>
            <div className="flex-1 w-full relative">
              <canvas
                ref={exportCanvasRef}
                className={`absolute inset-0 w-full h-full${isPolaroid ? '' : ' rounded'}`}
                style={{ display: 'block' }}
              />
            </div>
            {isPolaroid && element.caption && (
              <p className="text-center text-xs font-serif text-bark-muted mt-1 truncate px-1">
                {element.caption}
              </p>
            )}
          </div>
        )
      }

      return (
        <div className={`w-full h-full ${isPolaroid ? 'bg-white p-2 pb-6 shadow-md' : ''} flex flex-col overflow-hidden`}>
          <div className="flex-1 w-full relative overflow-hidden">
            <EncryptedImage
              src={element.url}
              alt=""
              crossOrigin="anonymous"
              className={`absolute inset-0 w-full h-full object-cover${isPolaroid ? '' : ' rounded'}`}
              style={{ transform: `scale(${imageScale * (flipped ? -1 : 1)}, ${imageScale})`, transformOrigin: 'center center' }}
              draggable={false}
            />
          </div>
          {isPolaroid && element.caption && (
            <p className="text-center text-xs font-serif text-bark-muted mt-1 truncate px-1">
              {element.caption}
            </p>
          )}
        </div>
      )
    }

    if (type === 'text') {
      const fontMap = {
        serif: "Georgia, 'Times New Roman', serif",
        sans: 'system-ui, -apple-system, sans-serif',
        mono: 'ui-monospace, monospace',
        display: "'Anton', 'Impact', 'Arial Narrow', sans-serif",
      }
      const isDisplay = element.fontFamily === 'display'
      const style = {
        fontSize: element.fontSize || 20,
        color: element.color || '#2D1B0E',
        fontFamily: fontMap[element.fontFamily] || fontMap.display,
        fontWeight: element.fontWeight || 'normal',
        textAlign: element.textAlign || 'center',
        // Display fonts (Anton) render with tall caps and extended ascenders
        // that html2canvas clips with a tight line-height, so we give them
        // more vertical breathing room.
        lineHeight: isDisplay ? 1.35 : 1.25,
        letterSpacing: isDisplay ? '0.02em' : 'normal',
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
          // overflow: visible so tall display glyphs (Anton) aren't clipped
          // by the bounding box during html2canvas capture.
          className="w-full h-full flex items-center justify-center"
          style={{ ...style, overflow: 'visible' }}
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

  const showHandles = isSelected && !isDragging && allowResize && !isEmptySlot && !exporting

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
        cursor: isDragging ? 'grabbing' : allowDrag ? 'grab' : 'pointer',
        userSelect: 'none',
        touchAction: 'none',
        opacity: isDragging ? 0.85 : 1,
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(id)
      }}
      {...(isEditing || !allowDrag ? {} : { ...listeners, ...attributes })}
    >
      {/* Element content */}
      <div className="w-full h-full">
        {renderContent()}
      </div>

      {/* Selection ring for empty slots (inner ring rendered by placeholder) */}
      {isSelected && !isDragging && isEmptySlot && !exporting && (
        <div className="absolute inset-0 ring-2 ring-kaydo pointer-events-none rounded" />
      )}

      {/* Selection ring + handles */}
      {showHandles && (
        <>
          <div className="absolute inset-0 border-2 border-kaydo pointer-events-none rounded" />

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
            className="absolute -top-7 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border-2 border-kaydo rounded-full flex items-center justify-center cursor-grab shadow z-10"
            style={{ touchAction: 'none' }}
          >
            <RotateCw className="w-3 h-3 text-kaydo" />
          </div>

          {/* Bring to front button */}
          <button
            onPointerDown={(e) => { e.stopPropagation(); onUpdate(id, { zIndex: Date.now() }) }}
            className="absolute -top-3 -right-3 w-6 h-6 bg-white border-2 border-kaydo text-kaydo rounded-full flex items-center justify-center shadow z-10 hover:bg-kaydo hover:text-white"
            style={{ touchAction: 'manipulation' }}
            title="Bring to front"
          >
            <ChevronsUp className="w-3 h-3" />
          </button>

          {/* Remove button for text elements */}
          {type === 'text' && (
            <button
              onPointerDown={(e) => { e.stopPropagation(); onDelete(id) }}
              className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-red-500 text-white text-xs rounded shadow z-10 hover:bg-red-600 whitespace-nowrap"
              style={{ touchAction: 'manipulation' }}
            >
              Remove
            </button>
          )}

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
              className="absolute w-[10px] h-[10px] bg-white border-2 border-kaydo rounded-sm z-10"
              style={{ ...style, touchAction: 'none' }}
            />
          ))}
        </>
      )}
    </div>
  )
}
