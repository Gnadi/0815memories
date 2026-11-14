import { useCallback } from 'react'
import { sendFeedback } from '../services/feedback'

/**
 * Sending feedback about the app itself — unencrypted and write-only, for
 * reasons services/feedback.js gives.
 */
export function useFeedbackWriter(familyId, { uid = null, role = null } = {}) {
  const submitFeedback = useCallback(
    (input) => sendFeedback(familyId, { uid, role }, input),
    [familyId, uid, role],
  )

  return { submitFeedback }
}
