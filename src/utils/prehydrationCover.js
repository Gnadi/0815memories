/* The cream cover index.html puts over the pre-rendered page.
 *
 * Paths that are not pre-rendered (src/prerenderedRoutes.js) are served the "/"
 * landing page's HTML, so before the app has rendered, a reload of /home or
 * /timeline would paint the marketing page. The inline script in index.html
 * hides #root behind the loading shell's cream instead (the .kaydo-restoring
 * class) whenever the HTML was built for another path, and on "/" when a
 * session is stored. Whatever renders the real page calls uncoverPage() once
 * it has committed.
 */
export const COVER_CLASS = 'kaydo-restoring'

export function uncoverPage() {
  if (typeof document === 'undefined') return
  document.documentElement.classList.remove(COVER_CLASS)
}
