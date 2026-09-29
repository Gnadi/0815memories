import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'

/**
 * Drag-to-reorder for the media in the post dialogs. Every item is both a
 * drag source and a drop target: dropping one onto another moves it into that
 * slot. On touch screens a short press starts the drag so the dialog still
 * scrolls.
 */
export default function SortableMediaGroup({ onMove, children }) {
  const sensors = useSensors(
    // MouseSensor rather than PointerSensor: Chrome on Android fires
    // pointerdown before touchstart, so a PointerSensor claimed every touch
    // first, and in a dialog that can scroll the browser took the gesture for a
    // scroll and cancelled it. Mouse events leave touches to the TouchSensor.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    onMove(active.id, over.id)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {children}
    </DndContext>
  )
}
