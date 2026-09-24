import { useCallback, useSyncExternalStore } from 'react'

/**
 * Whether a CSS media query matches, kept current as it changes.
 *
 * For when hiding a subtree with a Tailwind breakpoint is not enough because
 * the hidden copy still does work: it still mounts, still decodes its images
 * and still plays its videos. False where there is no `matchMedia` (tests,
 * prerender).
 */
export default function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const list = typeof window !== 'undefined' ? window.matchMedia?.(query) : null
      if (!list) return () => {}
      // Safari before 14 only has the older addListener API.
      if (list.addEventListener) {
        list.addEventListener('change', onChange)
        return () => list.removeEventListener('change', onChange)
      }
      list.addListener(onChange)
      return () => list.removeListener(onChange)
    },
    [query],
  )
  const matches = () =>
    typeof window !== 'undefined' ? window.matchMedia?.(query)?.matches === true : false
  return useSyncExternalStore(subscribe, matches, () => false)
}
