/* The reader's text size, kept per device.
 *
 * It is a browser preference like the language, not family data: a viewer
 * (Oma, Opa) has no account to store it on, and what they need on their
 * tablet is not what the family needs on the phone. So it lives in
 * localStorage and nowhere else.
 *
 * The size is a percentage on <html>. Tailwind sizes type, spacing and widths
 * in rem, so one number scales the whole app together and nothing has to opt
 * in. Media queries (the lg: layout breakpoints) ignore it on purpose: a larger
 * text size must not flip a phone into the desktop layout.
 *
 * index.html reads the same key and steps in a small inline script so the page
 * paints at the right size from the first frame; keep the two in step.
 */
import { useSyncExternalStore } from 'react'

export const TEXT_SIZE_STEPS = [80, 90, 100, 110, 120, 140, 160, 180]
export const DEFAULT_TEXT_SIZE = 100
export const TEXT_SIZE_KEY = 'kaydo_textsize'

const listeners = new Set()

// Storage throws in Safari private mode and when a browser blocks site data.
// A size that cannot be remembered still applies to the open page.
function readStored() {
  try {
    const stored = Number(localStorage.getItem(TEXT_SIZE_KEY))
    return TEXT_SIZE_STEPS.includes(stored) ? stored : DEFAULT_TEXT_SIZE
  } catch {
    return DEFAULT_TEXT_SIZE
  }
}

// Only in the browser: public routes are pre-rendered in Node, where there is
// no storage. Until a size is set in this tab, the stored one is current.
let current = typeof window === 'undefined' ? DEFAULT_TEXT_SIZE : readStored()

export function getTextSize() {
  return current
}

export function setTextSize(size) {
  if (!TEXT_SIZE_STEPS.includes(size) || size === current) return
  current = size
  if (typeof document !== 'undefined') {
    document.documentElement.style.fontSize = size === DEFAULT_TEXT_SIZE ? '' : `${size}%`
  }
  try {
    localStorage.setItem(TEXT_SIZE_KEY, String(size))
  } catch {
    /* not remembered, still applied */
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTextSize() {
  const size = useSyncExternalStore(subscribe, getTextSize, () => DEFAULT_TEXT_SIZE)
  return [size, setTextSize]
}
