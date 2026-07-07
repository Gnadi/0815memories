// Login-box configuration for custom-designed login pages. Stored as the
// `loginCard` map on the world-readable family doc, so every field is
// validated with a safe fallback — a malformed doc must never break login.

export const LOGIN_CARD_BEHAVIORS = ['minimized', 'card']
export const LOGIN_CARD_STYLES = ['light', 'dark', 'glass']

// Preset looks for the login card/overlay. `tone` drives the text colors in
// LoginForm and the card headings; inputs keep their cream background and
// dark text so they stay readable on every preset.
export const CARD_STYLES = {
  light: {
    cardClass: 'bg-warm-white/95 backdrop-blur',
    tone: 'light',
  },
  dark: {
    cardClass: 'bg-zinc-900/85 backdrop-blur border border-white/10',
    tone: 'dark',
  },
  glass: {
    cardClass: 'bg-white/55 backdrop-blur-xl border border-white/40',
    tone: 'light',
  },
}

export function normalizeLoginCard(raw) {
  const card = raw && typeof raw === 'object' ? raw : {}
  return {
    behavior: LOGIN_CARD_BEHAVIORS.includes(card.behavior) ? card.behavior : 'minimized',
    style: LOGIN_CARD_STYLES.includes(card.style) ? card.style : 'light',
  }
}
