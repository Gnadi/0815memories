import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'

export const AUTOSAVE_DELAY_MS = 2000

/**
 * Debounced autosave for an editor whose content is a `doc` and a `title`,
 * shared by the scrapbook, collage and highlight editors.
 *
 * Three things went wrong when each editor did this itself:
 *
 * - A save that finished marked the editor clean, whatever had changed while
 *   it was on its way. An edit made during a slow write was then shown as
 *   saved, its own pending save was cancelled, and reloading brought back the
 *   older version. `onSaved` therefore gets the `doc` and `title` that were
 *   written, and the editor only counts itself clean if they are still what it
 *   shows — compared by identity, which every editor's immutable updates keep
 *   meaningful.
 * - Two saves could be on their way at once, and as each encrypts before it
 *   writes, the older one could land last. They now run one after another.
 * - The scrapbook dropped anything changed in the last two seconds when it
 *   was left. `flush` writes it out before navigating, and unmounting writes
 *   whatever is still pending.
 *
 * @param {{
 *   doc: any, title: string, isDirty: boolean,
 *   write: (doc: any, title: string) => Promise<void>,
 *   onSaved: (doc: any, title: string) => void,
 *   onError?: (error: Error) => void,
 *   delay?: number,
 * }} options
 * @returns {{ saveStatus: 'idle'|'saving'|'saved'|'error', flush: () => Promise<boolean> }}
 *   `flush` resolves to false when the last write failed.
 */
export function useAutosave({ doc, title, isDirty, write, onSaved, onError, delay = AUTOSAVE_DELAY_MS }) {
  const [saveStatus, setSaveStatus] = useState('idle')
  const timerRef = useRef(null)
  const queueRef = useRef(Promise.resolve(true))
  const latestRef = useRef(null)
  // Before any effect of this render runs, so the unmount flush and a finished
  // write both compare against what is on screen.
  useLayoutEffect(() => {
    latestRef.current = { doc, title, isDirty, write, onSaved, onError }
  })

  const save = useCallback((savedDoc, savedTitle) => {
    const run = queueRef.current.then(async () => {
      setSaveStatus('saving')
      try {
        await latestRef.current.write(savedDoc, savedTitle)
      } catch (error) {
        latestRef.current.onError?.(error)
        setSaveStatus('error')
        return false
      }
      latestRef.current.onSaved(savedDoc, savedTitle)
      const { doc: shown, title: shownTitle } = latestRef.current
      // A newer edit is still waiting for its own write: keep saying so.
      if (shown === savedDoc && shownTitle === savedTitle) {
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus((status) => (status === 'saved' ? 'idle' : status)), 2000)
      }
      return true
    })
    queueRef.current = run
    return run
  }, [])

  useEffect(() => {
    if (!isDirty) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(doc, title), delay)
    return () => clearTimeout(timerRef.current)
  }, [isDirty, doc, title, save, delay])

  const flush = useCallback(() => {
    clearTimeout(timerRef.current)
    const { doc: pendingDoc, title: pendingTitle, isDirty: dirty } = latestRef.current
    return dirty ? save(pendingDoc, pendingTitle) : queueRef.current
  }, [save])

  // Fire and forget: the editor is going away, but its last change still has
  // to be written.
  useEffect(() => () => {
    clearTimeout(timerRef.current)
    const { doc: pendingDoc, title: pendingTitle, isDirty: dirty } = latestRef.current
    if (dirty) save(pendingDoc, pendingTitle)
  }, [save])

  return { saveStatus, flush }
}
