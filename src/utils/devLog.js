// Dev-only logging helpers. In production (import.meta.env.DEV === false) these
// are no-ops, so we don't leak internal errors/URLs to the browser console.
// Prefer these over bare console.* so production stays quiet.

export function devError(...args) {
  if (import.meta.env.DEV) console.error(...args)
}

export function devWarn(...args) {
  if (import.meta.env.DEV) console.warn(...args)
}
