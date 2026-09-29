import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

/**
 * One item of a SortableMediaGroup. `setRef` goes on the element that moves
 * and receives drops; `handleProps` on whatever starts the drag, which is the
 * whole tile for thumbnails and a grip for rows with inputs in them.
 *
 * Arrow keys move a focused item one slot, so the order can be changed without
 * a pointer. No KeyboardSensor is registered, so these do not compete with
 * dnd-kit's own key handling.
 */
export function useSortableMedia(id, { prevId, nextId, onMove }) {
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } =
    useDraggable({ id })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id })

  const setRef = (node) => {
    setDragRef(node)
    setDropRef(node)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      if (!prevId) return
      e.preventDefault()
      onMove(id, prevId)
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      if (!nextId) return
      e.preventDefault()
      onMove(id, nextId)
    }
  }

  return {
    setRef,
    handleProps: { ...attributes, ...listeners, onKeyDown: handleKeyDown },
    style: { transform: CSS.Translate.toString(transform) },
    isDragging,
    isOver: isOver && !isDragging,
  }
}

// Keeps a tap on a button inside a draggable from being claimed as a drag.
export const stopDrag = {
  onPointerDown: (e) => e.stopPropagation(),
  onTouchStart: (e) => e.stopPropagation(),
}
