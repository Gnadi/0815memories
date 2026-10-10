/**
 * An admin's own account, as opposed to their family: the password they sign in
 * with.
 *
 * Firebase Auth rather than Firestore, but kept here for the same reason as the
 * other services: pages ask for what they want done and leave the SDK to this.
 * Only the settings and the reset form load it, so it stays out of the startup
 * bundle.
 */
import {
  EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail, updatePassword,
} from 'firebase/auth'
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

/**
 * Firebase changes a password only right after a sign-in, so the current one
 * signs in again first. That is also what stops someone at an unlocked device
 * from changing it. Firebase then ends the account's sessions on every other
 * device; this one carries on.
 */
export async function changePassword(currentPassword, newPassword) {
  const user = auth?.currentUser
  if (!user?.email) throw new Error('Not signed in with a password')
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword))
  await updatePassword(user, newPassword)
}
