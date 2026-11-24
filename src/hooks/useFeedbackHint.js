import { useState } from 'react'

// "Not now" keeps the hint away for two months; feedback once sent, for half
// a year, so the question comes back only after the app has had time to change.
export const FEEDBACK_HINT_SNOOZE_MS = 60 * 24 * 60 * 60 * 1000
export const FEEDBACK_HINT_THANKS_MS = 180 * 24 * 60 * 60 * 1000
const KEY = 'kaydo_feedback_hint'

function hiddenUntil() {
  try {
    return Number(window.localStorage.getItem(KEY)) || 0
  } catch {
    return 0
  }
}

/**
 * Whether the home page asks for feedback on this device. The form was only
 * reachable through a small entry in the sidebar and the header, where few
 * found it. The answer is kept per device, like the login photo hint's.
 *
 * @returns {{ show: boolean, snooze: () => void, thank: () => void }}
 */
export function useFeedbackHint() {
  const [hidden, setHidden] = useState(() => hiddenUntil() > Date.now())

  const hideFor = (ms) => {
    try {
      window.localStorage.setItem(KEY, String(Date.now() + ms))
    } catch {
      // Storage blocked: it goes for this visit only.
    }
    setHidden(true)
  }

  return {
    show: !hidden,
    snooze: () => hideFor(FEEDBACK_HINT_SNOOZE_MS),
    // Only remembered: FeedbackHint keeps the card until the form, with its
    // thank-you, is closed, so nothing vanishes from under the dialog.
    thank: () => {
      try {
        window.localStorage.setItem(KEY, String(Date.now() + FEEDBACK_HINT_THANKS_MS))
      } catch {
        // Storage blocked: it comes back on the next visit.
      }
    },
  }
}
