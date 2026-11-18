import { useEffect, useState } from 'react'

// Long enough to cover the gap between two keys, short enough to read as
// following the typing.
export const SETTLE_MS = 200

/**
 * `text` once it has stopped changing for `ms`, for work too slow to redo on
 * every key, such as drawing a preview. The first value, and a change from
 * having no text at all (a form that has just loaded), come through at once.
 */
export default function useSettledText(text, ms = SETTLE_MS) {
  const [settled, setSettled] = useState(text)

  useEffect(() => {
    if (text === settled) return
    const timer = setTimeout(() => setSettled(text), settled === undefined ? 0 : ms)
    return () => clearTimeout(timer)
  }, [text, settled, ms])

  return settled
}
