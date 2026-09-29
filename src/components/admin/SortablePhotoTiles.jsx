import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import EncryptedImage from '../media/EncryptedImage'

function PhotoTile({ img, index, count, onRemove, onMove }) {
  const { t } = useTranslation('memory')
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } =
    useDraggable({ id: img.id })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: img.id })

  const setRef = (node) => {
    setDragRef(node)
    setDropRef(node)
  }

  // Arrow keys move a focused photo one slot, so the order can be changed
  // without a pointer. No KeyboardSensor is registered, so these do not
  // compete with dnd-kit's own key handling.
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      onMove(index, index - 1)
    } else if (e.key === 'ArrowRight' && index < count - 1) {
      e.preventDefault()
      onMove(index, index + 1)
    }
  }

  return (
    <div
      ref={setRef}
      {...attributes}
      {...listeners}
      onKeyDown={handleKeyDown}
      aria-label={t('photoOrder.tileLabel', { position: index + 1, count })}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`relative w-20 h-20 flex-shrink-0 rounded-xl select-none [-webkit-touch-callout:none] ${
        count > 1 ? 'cursor-grab touch-manipulation' : ''
      } ${isDragging ? 'z-20 cursor-grabbing opacity-80 shadow-lg' : ''} ${
        isOver && !isDragging ? 'ring-2 ring-kaydo ring-offset-2' : ''
      } focus:outline-none focus-visible:ring-2 focus-visible:ring-kaydo`}
    >
      {/* pointer-events-none keeps the browser's own image drag and long-press
          menu from hijacking the gesture meant for reordering. */}
      {img.preview?.startsWith('blob:') ? (
        <img
          src={img.preview}
          alt=""
          draggable={false}
          className="w-20 h-20 rounded-xl object-cover pointer-events-none"
        />
      ) : (
        <EncryptedImage
          src={img.preview}
          draggable={false}
          className="w-20 h-20 rounded-xl object-cover pointer-events-none"
        />
      )}
      {img.uploading && (
        <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {!img.uploading && (
        <button
          type="button"
          onClick={() => onRemove(img.id)}
          // Stops the tile's drag listeners from claiming a tap on the button.
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          aria-label={t('photoOrder.remove')}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-bark rounded-full flex items-center justify-center text-white hover:bg-bark-light"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

/**
 * The photo thumbnails of the post dialogs, in the order they will be saved.
 * Drag a photo onto another to put it in that place; on touch screens a short
 * press starts the drag so the dialog still scrolls. `children` renders after
 * the photos (the add and camera buttons) and is not draggable.
 */
export default function SortablePhotoTiles({ images, onRemove, onMove, className = '', children }) {
  const { t } = useTranslation('memory')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    onMove(active.id, over.id)
  }

  const moveByIndex = (from, to) => onMove(images[from].id, images[to].id)

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className={`flex gap-3 flex-wrap ${className}`}>
          {images.map((img, i) => (
            <PhotoTile
              key={img.id}
              img={img}
              index={i}
              count={images.length}
              onRemove={onRemove}
              onMove={moveByIndex}
            />
          ))}
          {children}
        </div>
      </DndContext>
      {images.length > 1 && (
        <p className="text-xs text-bark-muted mt-1.5">{t('photoOrder.hint')}</p>
      )}
    </>
  )
}
