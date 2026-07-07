import createDOMPurify from 'dompurify'

// Hard caps keep the world-readable family doc small and are mirrored in
// firestore.rules — change both together.
export const MAX_LOGIN_HTML_LENGTH = 64 * 1024
export const MAX_LOGIN_CSS_LENGTH = 32 * 1024

let purifier = null

// Lazy init: vite-react-ssg prerenders '/' at build time where window is
// undefined, so DOMPurify can only be constructed in the browser.
function getPurifier() {
  if (typeof window === 'undefined') return null
  if (!purifier) {
    purifier = createDOMPurify(window)
    purifier.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer')
      }
    })
  }
  return purifier
}

const PURIFY_CONFIG = {
  USE_PROFILES: { html: true, svg: true },
  // MySpace-era niceties. marquee/blink render as inline elements in modern
  // browsers but CSS can still animate them; audio/video for ambience.
  ADD_TAGS: ['marquee', 'blink', 'audio', 'video', 'source'],
  ADD_ATTR: [
    'behavior', 'direction', 'scrollamount', 'scrolldelay', 'loop',
    'controls', 'autoplay', 'muted', 'playsinline', 'poster', 'preload',
  ],
  // No <style> (custom CSS lives in its own field and is scoped separately),
  // nothing that looks like or hosts a form (the login page has a real
  // password field — custom content must not be able to spoof one), and
  // nothing that embeds a foreign browsing context.
  FORBID_TAGS: [
    'style', 'form', 'input', 'textarea', 'select', 'option', 'optgroup',
    'button', 'label', 'fieldset', 'datalist', 'output', 'dialog',
    'iframe', 'frame', 'frameset', 'object', 'embed', 'base', 'link', 'meta',
  ],
  // on* handlers are stripped by default; additionally block focus- and
  // shadow-DOM-related attributes that could interfere with the login form.
  FORBID_ATTR: [
    'contenteditable', 'autofocus', 'tabindex', 'formaction', 'form',
    'slot', 'part', 'exportparts',
  ],
}

export function sanitizeLoginHtml(html) {
  const p = getPurifier()
  if (!p || !html || typeof html !== 'string') return ''
  return p.sanitize(html.slice(0, MAX_LOGIN_HTML_LENGTH), PURIFY_CONFIG)
}

// The CSS is injected via `styleElement.textContent` inside a shadow root:
// textContent never goes through the HTML parser (no </style><script>
// breakout) and shadow scoping stops any selector from reaching the login
// form. Stripping @import only prevents loading third-party stylesheets
// (visitor-IP privacy); the rest is belt-and-braces for legacy engines.
export function sanitizeLoginCss(css) {
  if (!css || typeof css !== 'string') return ''
  return css
    .slice(0, MAX_LOGIN_CSS_LENGTH)
    .replace(/@import\b[^;]*(;|$)/gi, '')
    .replace(/expression\s*\(/gi, 'blocked(')
    .replace(/javascript\s*:/gi, 'blocked:')
}
