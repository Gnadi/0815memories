/* The reader's text size, kept per device.
 *
 * It is a browser preference like the language, not family data: a viewer
 * (Oma, Opa) has no account to store it on, and what they need on their
 * tablet is not what the family needs on the phone. So it lives in
 * localStorage and nowhere else.
 *
 * The size is applied as a percentage on <html>. Tailwind sizes type, spacing
 * and widths in rem, so one number scales the whole app together and nothing
 * has to opt in. Media queries (the lg: layout breakpoints) ignore it on
 * purpose: a larger text size must not flip a phone into the desktop layout.
 *
 * index.html reads the same key in a small inline script so the page paints at
 * the right size from the first frame; keep the two in step.
 */
import { useSyncExternalStore } from 'react'

export const TEXT_SIZES = ['normal', 'large', 'xlarge']
export const DEFAULT_TEXT_SIZE = 'normal'
export const TEXT_SIZE_KEY = 'kaydo_textsize'

const listeners = new Set()

// Storage throws in Safari private mode and when a browser blocks site data.
// A size that cannot be remembered still applies to the open page.
function readStored() {
  try {
    const stored = localStorage.getItem(TEXT_SIZE_KEY)
    return TEXT_SIZES.includes(stored) ? stored : DEFAULT_TEXT_SIZE
  } catch {
    return DEFAULT_TEXT_SIZE
  }
}

// Only in the browser: public routes are pre-rendered in Node, where there is
// no document. Until a size is set in this tab, the stored one is current.
let current = typeof window === 'undefined' ? DEFAULT_TEXT_SIZE : readStored()

function apply(size) {
  if (typeof document === 'undefined') return
  if (size === DEFAULT_TEXT_SIZE) document.documentElement.removeAttribute('data-text-size')
  else document.documentElement.setAttribute('data-text-size', size)
}

export function getTextSize() {
  return current
}

export function setTextSize(size) {
  if (!TEXT_SIZES.includes(size) || size === current) return
  current = size
  apply(size)
  try {
    localStorage.setItem(TEXT_SIZE_KEY, size)
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
