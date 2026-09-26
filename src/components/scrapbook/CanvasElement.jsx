import { useRef, useState, useCallback, useEffect, useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDraggable } from '@dnd-kit/core'
import { Trash2, RotateCw, ImagePlus, ChevronsUp } from 'lucide-react'
import EncryptedImage from '../media/EncryptedImage'
import useDecryptedMedia from '../media/useDecryptedMedia'
// object-cover + zoom + mirror maths, shared with the collage renderer so both
// editors crop a photo the same way. Drawing onto a <canvas> is what bypasses
// html2canvas's broken overflow:hidden handling.
import { drawImageCovered } from '../../utils/collageRenderer'
// Same reasoning for glyphs: html2canvas places them with font metrics of its
// own and gets the display face wrong, so the export paints the text itself.
import { drawTextBlock, prepareExportCanvas } from '../../utils/canvasText'
// Marks a canvas the capture still has to wait for.
import { EXPORT_PENDING_ATTR } from './exportReady'
// Zoom, pan and "whole photo" — the same crop on screen and in the export.
import { effectiveScale, imageLayout, panBy } from './photoCrop'

const HANDLE_SIZE = 10

const FONT_STACKS = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: 'system-ui, -apple-system, sans-serif',
  mono: 'ui-monospace, monospace',
  display: "'Anton', 'Impact', 'Arial Narrow', sans-serif",
}

// Display type (Anton) is tracked out slightly and gets more line spacing than
// the text faces, in the editor and in the export alike.
const DISPLAY_LETTER_SPACING_EM = 0.02
const DISPLAY_LINE_HEIGHT = 1.35
const TEXT_LINE_HEIGHT = 1.25

// The export canvas reaches this far past the element box on every side, so
// tall glyphs keep the overflow the editor's `overflow: visible` gives them.
const TEXT_OVERFLOW_PAD = 0.75

export default function CanvasElement({
  element,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  canvasScale,
  editable = true,
  exporting = false,
  cropping = false,
}) {
  const { t } = useTranslation('scrapbook')
  const { id, type, x, y, width, height, rotation = 0, zIndex = 0 } = element
  const elementRef = useRef(null)
  const exportCanvasRef = useRef(null)
  const [isEditing, setIsEditing] = useState(false)
  // The photo's frame (inside the polaroid border, when there is one) and the
  // photo's own pixel size: together they decide which part of it is shown.
  const photoFrameRef = useRef(null)
  const [frameSize, setFrameSize] = useState(null)
  // Keyed by url, so a replaced photo never borrows the previous one's size.
  const [loadedSize, setNaturalSize] = useState(null)
  const naturalSize = loadedSize && loadedSize.url === element.url ? loadedSize : null
  const cropFit = element.fit || null
  const cropScale = element.imageScale || 1
  const cropOffsetX = element.offsetX || 0
  const cropOffsetY = element.offsetY || 0

  // Always decrypt the image URL so it's warm in the cache before export starts.
  // (EncryptedImage does the same internally; the shared cache avoids double-fetching.)
  const { decryptedUrl } = useDecryptedMedia(
    type === 'photo' ? element.url : null,
    'image/*'
  )

  // When exporting, draw the correctly-cropped image onto the canvas element.
  // html2canvas reads <canvas> pixel data directly, so no overflow/clip tricks needed.
  //
  // Decrypting the photo and decoding it are both asynchronous, and the editor
  // only mounts the page it is showing, so the canvas is empty for a while
  // after the export switches to a page. It carries EXPORT_PENDING_ATTR until
  // the photo is on it and the export waits for that: a capture that raced it
  // came out with photos missing.
  useEffect(() => {
    if (!exporting || type !== 'photo' || !exportCanvasRef.current) return
    const canvas = exportCanvasRef.current
    canvas.setAttribute(EXPORT_PENDING_ATTR, '')
    if (!decryptedUrl) return undefined
    const cw = canvas.offsetWidth || width
    const ch = canvas.offsetHeight || height
    if (!cw || !ch) return undefined
    const flipped = !!element.flipped
    // A backing store at the capture's own scale — at CSS resolution the PDF
    // would be upscaling every photo by two.
    const ctx = prepareExportCanvas(canvas, cw, ch)
    const img = new Image()
    let cancelled = false
    img.onload = () => {
      if (cancelled) return
      const scale = effectiveScale({ fit: cropFit, imageScale: cropScale }, img.naturalWidth, img.naturalHeight, cw, ch)
      drawImageCovered(ctx, img, cw, ch, scale, flipped, cropOffsetX, cropOffsetY)
      canvas.removeAttribute(EXPORT_PENDING_ATTR)
    }
    // A photo that cannot be loaded must not hold the whole export hostage.
    img.onerror = () => {
      if (!cancelled) canvas.removeAttribute(EXPORT_PENDING_ATTR)
    }
    img.src = decryptedUrl
    return () => { cancelled = true }
  }, [exporting, type, decryptedUrl, cropFit, cropScale, cropOffsetX, cropOffsetY, element.flipped, width, height])

  // Text styling, shared by the editor's DOM and the export's canvas so both
  // read from one source.
  const isDisplay = element.fontFamily === 'display'
  const fontSize = element.fontSize || 20
  const stickerSize = element.stickerSize || 48
  const fontFamily = FONT_STACKS[element.fontFamily] || FONT_STACKS.display
  const fontWeight = element.fontWeight || 'normal'
  const textColor = element.color || '#2D1B0E'
  const textAlign = element.textAlign || 'center'
  const lineHeight = isDisplay ? DISPLAY_LINE_HEIGHT : TEXT_LINE_HEIGHT
  const overflowPad = Math.ceil((type === 'sticker' ? stickerSize : fontSize) * TEXT_OVERFLOW_PAD)

  // Glyphs take the same route as photos during export, and for the same kind
  // of reason: html2canvas lays text out itself from font metrics it measures
  // with a probe element, and when the probe is wrong about the display face
  // every line lands too low. Painting the text here means html2canvas only
  // copies pixels.
  useEffect(() => {
    if (!exporting || (type !== 'text' && type !== 'sticker') || !exportCanvasRef.current) return
    const canvas = exportCanvasRef.current
    const boxW = width + overflowPad * 2
    const boxH = height + overflowPad * 2
    if (!boxW || !boxH) return
    const ctx = prepareExportCanvas(canvas, boxW, boxH)
    ctx.clearRect(0, 0, boxW, boxH)
    drawTextBlock(ctx, {
      text: type === 'sticker' ? element.emoji || '' : element.text || '',
      width,
      height,
      offsetX: overflowPad,
      offsetY: overflowPad,
      // Stickers are emoji in whatever face the page inherits.
      fontSize: type === 'sticker' ? stickerSize : fontSize,
      fontFamily: type === 'sticker' ? getComputedStyle(canvas).fontFamily : fontFamily,
      fontWeight: type === 'sticker' ? 'normal' : fontWeight,
      color: textColor,
      textAlign: type === 'sticker' ? 'center' : textAlign,
      lineHeight,
      letterSpacing: type === 'text' && isDisplay ? fontSize * DISPLAY_LETTER_SPACING_EM : 0,
    })
  }, [
    exporting, type, width, height, overflowPad, element.text, element.emoji,
    stickerSize, fontSize, fontFamily, fontWeight, textColor, textAlign, lineHeight, isDisplay,
  ])

  // Sized past the element box on every side so tall glyphs are not cut off,
  // exactly as `overflow: visible` lets them spill in the editor.
  const exportCanvas = (
    <canvas
      ref={exportCanvasRef}
      style={{
        position: 'absolute',
        left: -overflowPad,
        top: -overflowPad,
        width: width + overflowPad * 2,
        height: height + overflowPad * 2,
        display: 'block',
      }}
    />
  )

  // Photos are "slots" when they have no url yet. Slots are always selectable
  // (so users can fill them via the PhotoBar) but are never draggable/resizable
  // unless the page has been put into "customize" mode.
  const isEmptySlot = type === 'photo' && !element.url

  // When `editable` is false (fixed layout) and this is a photo, freeze
  // position/size. Text and stickers remain free-form regardless.
  //
  // A selected photo is panned inside its frame instead of moved whenever the
  // frame itself is fixed (a locked layout) or the crop panel is open.
  const canPan = type === 'photo' && !!element.url && isSelected && !exporting && (cropping || !editable)
  const allowDrag = (editable && !canPan) || type !== 'photo'
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
    const gesture = crypto.randomUUID()

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

      onUpdate(id, { width: newW, height: newH, x: newX, y: newY }, gesture)
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
    const gesture = crypto.randomUUID()

    const onMove = (me) => {
      const angle = Math.atan2(me.clientY - cy, me.clientX - cx) * (180 / Math.PI) + 90
      onUpdate(id, { rotation: Math.round(angle) }, gesture)
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [id, onUpdate])

  // Measured rather than derived from width/height: the polaroid border and its
  // caption take a share of the element that the photo does not get.
  useLayoutEffect(() => {
    const node = photoFrameRef.current
    if (!node) return
    const w = node.offsetWidth
    const h = node.offsetHeight
    setFrameSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }))
  }, [width, height, element.url, element.polaroid, element.caption, exporting])

  // Drag the picture under the finger. The movement is turned into the
  // element's own axes first, so a tilted polaroid pans along its tilt.
  const handlePanPointerDown = useCallback((e) => {
    if (!canPan || !naturalSize || !frameSize) return
    e.stopPropagation()
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const start = { fit: cropFit, imageScale: cropScale, offsetX: cropOffsetX, offsetY: cropOffsetY, flipped: element.flipped }
    const rad = (-rotation * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const gesture = crypto.randomUUID()

    const onMove = (me) => {
      const sx = (me.clientX - startX) / canvasScale
      const sy = (me.clientY - startY) / canvasScale
      const dx = sx * cos - sy * sin
      const dy = sx * sin + sy * cos
      onUpdate(id, panBy(start, naturalSize.w, naturalSize.h, frameSize.w, frameSize.h, dx, dy), gesture)
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [canPan, naturalSize, frameSize, cropFit, cropScale, cropOffsetX, cropOffsetY, element.flipped, rotation, canvasScale, id, onUpdate])

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
                {t('canvas.tapToAddPhoto')}
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

      // Once the photo's size is known it is placed exactly where the export
      // will crop it; until then a plain centred cover crop stands in.
      const layout = naturalSize && frameSize
        ? imageLayout(
          naturalSize.w, naturalSize.h, frameSize.w, frameSize.h,
          effectiveScale(element, naturalSize.w, naturalSize.h, frameSize.w, frameSize.h),
          cropOffsetX, cropOffsetY,
        )
        : null
      return (
        <div className={`w-full h-full ${isPolaroid ? 'bg-white p-2 pb-6 shadow-md' : ''} flex flex-col overflow-hidden`}>
          <div
            ref={photoFrameRef}
            className={`flex-1 w-full relative overflow-hidden${isPolaroid ? '' : ' rounded'}`}
            onPointerDown={canPan ? handlePanPointerDown : undefined}
            style={canPan ? { cursor: 'move' } : undefined}
          >
            <div className="absolute inset-0" style={flipped ? { transform: 'scaleX(-1)' } : undefined}>
              <EncryptedImage
                src={element.url}
                alt=""
                crossOrigin="anonymous"
                className={layout ? 'absolute' : 'absolute inset-0 w-full h-full object-cover'}
                style={layout
                  ? { left: layout.left, top: layout.top, width: layout.width, height: layout.height, maxWidth: 'none' }
                  : { transform: `scale(${imageScale})`, transformOrigin: 'center center' }}
                onLoad={(e) => {
                  const { naturalWidth: w, naturalHeight: h, src } = e.currentTarget
                  // The blank placeholder loads first; only the decrypted photo counts.
                  if (!w || !h || src.startsWith('data:')) return
                  const url = element.url
                  setNaturalSize((prev) => (prev && prev.url === url && prev.w === w && prev.h === h ? prev : { url, w, h }))
                }}
                draggable={false}
              />
            </div>
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
      const style = {
        fontSize,
        color: textColor,
        fontFamily,
        fontWeight,
        textAlign,
        // Display fonts (Anton) render with tall caps and extended ascenders
        // that a tight line-height crowds, so we give them more vertical
        // breathing room.
        lineHeight,
        letterSpacing: isDisplay ? `${DISPLAY_LETTER_SPACING_EM}em` : 'normal',
      }

      if (exporting) return exportCanvas

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
            {element.text || t('canvas.doubleClickToEdit')}
          </span>
        </div>
      )
    }

    if (type === 'sticker') {
      if (exporting) return exportCanvas
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
            title={t('canvas.bringToFront')}
          >
            <ChevronsUp className="w-3 h-3" />
          </button>

          {/* Remove button for text and sticker elements */}
          {(type === 'text' || type === 'sticker') && (
            <button
              onPointerDown={(e) => { e.stopPropagation(); onDelete(id) }}
              className="absolute -bottom-9 left-1/2 -translate-x-1/2 px-3 py-1 bg-red-500 text-white text-sm font-medium rounded-md shadow z-10 hover:bg-red-600 whitespace-nowrap"
              style={{ touchAction: 'manipulation' }}
            >
              {t('canvas.remove')}
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
