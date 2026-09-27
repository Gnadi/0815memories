/* The cream cover index.html puts over the pre-rendered page.
 *
 * Every URL is served the same pre-rendered HTML — the "/" landing page — so
 * before the app has rendered, a reload of /home or /timeline would paint the
 * marketing page. The inline script in index.html hides #root behind the
 * loading shell's cream instead (the .kaydo-restoring class), on every path but
 * "/" and on "/" when a session is stored. Whatever renders the real page
 * calls uncoverPage() once it has committed.
 */
export const COVER_CLASS = 'kaydo-restoring'

export function uncoverPage() {
  if (typeof document === 'undefined') return
  document.documentElement.classList.remove(COVER_CLASS)
}
