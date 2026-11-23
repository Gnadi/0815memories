import { useCallback, useState } from 'react'

// Below this many pixels high, a phone's picture is a strip, not a picture.
export const MIN_PICTURE_HEIGHT = 96

/**
 * Whether the picture of the login, signup and invite pages has room on a
 * phone. There it gets the height the form leaves over, and below
 * MIN_PICTURE_HEIGHT it steps aside and leaves the space empty.
 *
 * Measured rather than guessed from the screen's height: the form's height
 * changes with the page, the step, the language and the text size. A
 * container query would say it more simply, but Chrome measured that flex
 * item before it grew and hid the picture on every phone.
 *
 * @returns {[(node: HTMLElement | null) => (() => void) | undefined, boolean]}
 *   a ref for the picture's box, and whether it is too small
 */
export function usePictureRoom() {
  const [tooSmall, setTooSmall] = useState(false)
  const ref = useCallback((node) => {
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      setTooSmall(entry.contentRect.height < MIN_PICTURE_HEIGHT)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return [ref, tooSmall]
}
