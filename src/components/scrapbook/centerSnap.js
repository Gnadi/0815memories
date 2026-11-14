// Dragging an element near the middle of the page snaps it there and shows a
// guide line, so centring by eye is not a matter of luck.

// In page pixels (the 800 × 600 canvas), not screen pixels, so the pull feels
// the same at any zoom.
export const SNAP_DISTANCE = 6

/**
 * Where an element dragged to (x, y) ends up and which centre lines it sits on.
 * Rotation turns an element around its centre, so the centre is x + width / 2
 * whatever the angle.
 */
export function snapToCenter(element, x, y, pageWidth, pageHeight, distance = SNAP_DISTANCE) {
  const dx = pageWidth / 2 - (x + element.width / 2)
  const dy = pageHeight / 2 - (y + element.height / 2)
  const vertical = Math.abs(dx) <= distance
  const horizontal = Math.abs(dy) <= distance
  return {
    x: vertical ? x + dx : x,
    y: horizontal ? y + dy : y,
    // `vertical` is the line that runs top to bottom (horizontal centring).
    guides: { vertical, horizontal },
  }
}
