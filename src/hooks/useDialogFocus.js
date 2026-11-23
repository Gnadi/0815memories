import { useEffect } from 'react'

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Keeps keyboard focus inside a modal dialog while it is open, and hands it
 * back once the dialog closes: to `returnRef` when given, otherwise to
 * whatever had it before. Pass `returnRef` when a field in the dialog has
 * autoFocus — React focuses it before this hook runs, so "whatever had it
 * before" would be that field.
 *
 * Without it, Tab walked out of the dialog into the page behind the backdrop,
 * and closing it left focus on the body, so a keyboard user started over at
 * the top of the page. Focus moves into the dialog only if nothing inside it
 * took it already (an autoFocus field does).
 */
export default function useDialogFocus(ref, open, returnRef) {
  useEffect(() => {
    if (!open || !ref.current) return
    const dialog = ref.current
    const previous = returnRef?.current || document.activeElement

    const focusables = () => [...dialog.querySelectorAll(FOCUSABLE)]
      .filter((el) => !el.closest('[inert]'))
    if (!dialog.contains(document.activeElement)) focusables()[0]?.focus()

    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previous && typeof previous.focus === 'function' && previous.isConnected) previous.focus()
    }
  }, [ref, open, returnRef])
}
