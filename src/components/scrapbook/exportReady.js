/**
 * Keeping the PDF capture in step with the canvases it is about to photograph.
 *
 * A photo reaches its export canvas only after it has been fetched, decrypted
 * and decoded, and the editor only mounts the page it is showing — so when the
 * export switches to a page, its canvases are blank for a while. The capture
 * used to just wait three animation frames and hope; when a decode took longer
 * than that, the photo was missing from the PDF. Each canvas now says when it
 * is still waiting, and the capture waits with it.
 */

/** Present on an export canvas until it has been painted. */
export const EXPORT_PENDING_ATTR = 'data-export-pending'

/** How long to wait before exporting a page without a photo that never came. */
export const EXPORT_PENDING_TIMEOUT_MS = 15000

/**
 * Resolve once no canvas under `root` is still waiting to be painted, or once
 * `timeoutMs` has passed.
 *
 * Polls on a timer rather than requestAnimationFrame, so an export still
 * finishes when the tab is in the background and frames stop being served.
 */
export function waitForExportCanvases(root, timeoutMs = EXPORT_PENDING_TIMEOUT_MS) {
  if (!root) return Promise.resolve()
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve) => {
    const check = () => {
      if (!root.querySelector(`[${EXPORT_PENDING_ATTR}]`) || Date.now() >= deadline) resolve()
      else setTimeout(check, 30)
    }
    check()
  })
}
