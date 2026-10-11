/**
 * "Forgot password?" for admins. On its own, away from services/account.js:
 * the login page loads it, so it should bring as little else as it can.
 */
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../config/firebase'

/**
 * The link in the email opens Firebase's own page, in `language`, which then
 * offers the way back to this one. That way back has to be on the project's
 * list of authorized domains, or Firebase refuses to send anything at all — so
 * then the email goes out without it rather than not at all.
 */
export async function requestPasswordReset(email, language) {
  if (!auth) throw new Error('Firebase not configured — add env vars and reload')
  auth.languageCode = language
  try {
    await sendPasswordResetEmail(auth, email, { url: window.location.href })
  } catch (err) {
    if (err?.code !== 'auth/unauthorized-continue-uri' && err?.code !== 'auth/invalid-continue-uri') throw err
    await sendPasswordResetEmail(auth, email)
  }
}
