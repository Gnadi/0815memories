/**
 * Puts the app's stylesheet into the pre-rendered pages instead of linking it.
 *
 * A linked stylesheet blocks the first paint, and on a slow phone connection
 * it costs a round trip of its own after the HTML has arrived: measured with
 * PageSpeed's throttling, the landing page's first paint came at about 1.0 s
 * with the link and 0.5 s without. The stylesheet is 18 KB compressed and the
 * landing page uses nearly all of it, so the HTML grows by that much and
 * nothing is downloaded that was not before.
 *
 * What is given up: the stylesheet is no longer cached on its own across
 * deploys. The HTML is revalidated on every visit anyway (vercel.json), so a
 * returning visitor gets a 304 until the next deploy, as before.
 *
 * Only the stylesheet Vite links from the entry is inlined. Styles that route
 * chunks bring with them are still loaded with those chunks.
 */
const STYLESHEET = /<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/

/**
 * `html` with its stylesheet link replaced by a <style> of the file's content.
 * `read` returns the content of a path such as "/assets/app-1.css". A page with
 * no such link, or whose file cannot be read, is returned as it was: slower,
 * never unstyled.
 */
export function inlineStylesheet(html, read) {
  const match = STYLESHEET.exec(html)
  if (!match) return html
  let css
  try {
    css = read(match[1])
  } catch {
    return html
  }
  // A function, not a string: "$&" and friends in the CSS mean something to
  // String.replace.
  return html.replace(match[0], () => `<style>${css}</style>`)
}
