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

/** Mirrors REAUTH_REQUIRED_MESSAGE in functions/membership.js. */
export const REAUTH_REQUIRED = 'Confirm your password again'

/** Whether the server refused because the password was not typed recently enough. */
export const needsFreshLogin = (err) =>
  err?.code === 'functions/failed-precondition' && err?.message === REAUTH_REQUIRED
