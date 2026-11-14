import { useSyncExternalStore } from 'react'
import { detectPlatform } from '../utils/platform'

// The platform does not change while the page is open, so there is nothing to
// subscribe to. The server snapshot keeps pre-rendered pages neutral: Node has
// no navigator, and the browser must hydrate the markup Node produced.
const subscribe = () => () => {}
const getServerSnapshot = () => 'other'

export default function usePlatform() {
  return useSyncExternalStore(subscribe, detectPlatform, getServerSnapshot)
}
