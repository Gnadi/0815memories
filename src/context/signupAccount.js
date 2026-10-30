import {
  createUserWithEmailAndPassword, updateProfile, setPersistence, browserLocalPersistence,
  sendEmailVerification,
} from 'firebase/auth'
import { auth, db } from '../config/firebase'
import { generateSlug } from '../utils/familySlug'
import { isSlugAvailable } from '../services/family'
import { setSessionOnly } from '../utils/authStorage'
import { devWarn } from '../utils/devLog'

/**
 * Creates an admin account and sends the confirmation mail: the first of the
 * two steps of signing up (the second, founding the family, is
 * createOwnFamily in AuthProviderImpl).
 *
 * A module of its own so that the landing page's claim form can run it
 * without the app's auth provider: Firebase is loaded when someone submits
 * the form, not for everyone who opens the page. The provider picks the
 * session up from the SDK once the visitor is on /signup.
 *
 * A password reset goes to the address the account was registered with, so an
 * account whose address nobody confirmed belongs to whoever reads that
 * mailbox. firestore.rules therefore lets an account found a family, or
 * redeem an invite, only once Firebase has confirmed its address.
 */
export async function signupAccount(email, password, displayName, familyName, language) {
  if (!auth || !db) throw new Error('Firebase not configured — add env vars and reload')

  // Checked now as well as when the family is founded, so a taken name is
  // reported before an account exists.
  if (familyName) {
    const slug = generateSlug(familyName)
    if (!slug) throw new Error('Family name produces an invalid URL — please use letters or numbers')
    if (!(await isSlugAvailable(slug))) throw new Error('This family name is already taken — please choose another')
  }

  // A brand-new account is always remembered; clears any session-only marker
  // left in this window by an earlier login.
  setSessionOnly(false)
  try {
    await setPersistence(auth, browserLocalPersistence)
  } catch (err) {
    if (import.meta.env.DEV) console.warn('Could not set auth persistence:', err)
  }

  const result = await createUserWithEmailAndPassword(auth, email, password)
  if (displayName) {
    await updateProfile(result.user, { displayName }).catch((err) => devWarn('Could not set the name:', err))
  }
  if (language) auth.languageCode = language
  await sendEmailVerification(result.user)
}
