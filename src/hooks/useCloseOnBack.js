import { useCallback, useEffect, useRef } from 'react'

// The flag an overlay's own history entry carries, next to the router's state.
const KEY = 'kaydoOverlay'

// Lets the browser's back button (and the back gesture on a phone) close a
// full-screen overlay instead of leaving the page beneath it.
//
// An overlay like the story viewer is state, not a route, so it added nothing
// to the history: back went to whatever came before the page, which for a
// family that opened the app on /home was outside the app altogether. Opening
// now pushes an entry for the same URL, keeping the router's state so the
// router sees no navigation, and going back from it closes the overlay.
//
// Returns the function to close it with from inside: it takes the entry back
// out of the history first, so a close button does not leave a dead entry for
// the next back to land on. The popstate that follows is what calls onClose.
export default function useCloseOnBack(onClose) {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    // StrictMode mounts twice; the second mount finds its entry already there.
    if (!window.history.state?.[KEY]) {
      window.history.pushState({ ...window.history.state, [KEY]: true }, '')
    }
    const handlePop = () => {
      if (!window.history.state?.[KEY]) onCloseRef.current?.()
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  return useCallback(() => {
    if (window.history.state?.[KEY]) window.history.back()
    // Something else has moved the history on since the overlay opened, so
    // there is no entry of ours on top to take back; just close.
    else onCloseRef.current?.()
  }, [])
}
