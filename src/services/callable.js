/**
 * Calling one of Kaydo's Cloud Functions (functions/index.js).
 *
 * `firebase/functions` is loaded when the first call is made: the invite page
 * is part of the startup bundle, and nothing there needs the SDK before
 * someone presses a button.
 */
import { functions } from '../config/firebase'

/** The function's answer. Rejects with the SDK's error, whose `code` is `functions/<code>`. */
export async function callFunction(name, data) {
  if (!functions) throw new Error('Firebase is not configured')
  const { httpsCallable } = await import('firebase/functions')
  const result = await httpsCallable(functions, name)(data)
  return result.data
}
