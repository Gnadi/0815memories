import { useEffect, useRef } from 'react'
import { sanitizeLoginHtml, sanitizeLoginCss } from '../utils/loginPageSanitizer'

// Renders admin-authored HTML/CSS inside a shadow root. The shadow boundary
// isolates both ways: custom CSS selectors cannot reach the login form (no
// restyling or attribute-selector tricks against the password input), and
// the app's styles don't bleed into the custom canvas.
export default function CustomLoginCanvas({ html, css, className = 'absolute inset-0 z-0' }) {
  const hostRef = useRef(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host || typeof host.attachShadow !== 'function') return
    const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' })
    shadow.innerHTML = ''

    const style = document.createElement('style')
    // textContent assignment bypasses the HTML parser, so the CSS string can
    // never break out of the style element.
    style.textContent =
      ':host{display:block;height:100%;overflow:auto}\n' + sanitizeLoginCss(css)
    shadow.appendChild(style)

    const root = document.createElement('div')
    root.className = 'canvas' // documented styling hook for the admin's CSS
    root.innerHTML = sanitizeLoginHtml(html)
    shadow.appendChild(root)
  }, [html, css])

  // isolation:isolate creates a new stacking context: no z-index inside the
  // shadow tree can ever paint above the sibling login-form overlay.
  // contain:paint makes the host the containing block even for
  // position:fixed descendants and clips them, so custom content can never
  // escape the canvas (on the login page it fills the viewport anyway, but
  // in the designer preview it must stay inside the preview box).
  return <div ref={hostRef} className={className} style={{ isolation: 'isolate', contain: 'paint' }} />
}
