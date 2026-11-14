import { useEffect, useState } from 'react'

/** A number counting up to `target`, fast at first and settling on it. */
export default function useCountUp(target, durationMs = 1400) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let frame
    const start = performance.now()
    const step = (now) => {
      const t = Math.min(1, (now - start) / durationMs)
      // Ease out: fast at first, settling on the number.
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs])
  return value
}
