/**
 * An admin's own account, as opposed to their family: the password they sign in
 * with, and leaving for good — the account, or for its owner the whole family.
 *
 * Firebase Auth rather than Firestore, but kept here for the same reason as the
 * other services: pages ask for what they want done and leave the SDK to this.
 * Only the settings load it, so it stays out of the startup bundle; the reset
 * of a forgotten password is in services/passwordReset.js, for the login page.
 */
import { EmailAuthProvider, deleteUser, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from '../config/firebase'
import { removeFCMToken } from '../utils/notifications'
import { openInvitesBy, removeAdmin } from './admins'

/**
 * Firebase changes a password only right after a sign-in, so the current one
 * signs in again first. That is also what stops someone at an unlocked device
 * from changing it. Firebase then ends the account's sessions on every other
 * device; this one carries on.
 */
export async function changePassword(currentPassword, newPassword) {
  const user = await confirmIdentity(currentPassword)
  await updatePassword(user, newPassword)
}

// Signing in again, for what Firebase only does right after a sign-in and
// what nobody should do from a device someone else left unlocked.
async function confirmIdentity(password) {
  const user = auth?.currentUser
  if (!user?.email) throw new Error('Not signed in with a password')
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))
  return user
}

/**
 * An admin who is not the owner leaves for good: out of the family, then the
 * account. What they posted stays; it is the family's, and its owner can
 * delete it. The invites they made go too, or the links would still let them
 * back in.
 *
 * In this order because each step needs the one before still standing: the
 * device's push registration needs a member, leaving needs the account.
 */
export async function deleteOwnAccount(familyId, password) {
  const user = await confirmIdentity(password)
  await removeFCMToken().catch(() => {})
  await removeAdmin(familyId, user.uid, await openInvitesBy(familyId, user.uid))
  await deleteUser(user)
}

/**
 * The owner deletes the whole family: everything in it, every admin's account
 * and the guests' access. The deleteFamily function locks everyone out at
 * once and works through the rest on the server (functions/familyDeletion.js).
 */
export async function deleteFamily(familyId, password) {
  await confirmIdentity(password)
  await httpsCallable(functions, 'deleteFamily')({ familyId })
}
