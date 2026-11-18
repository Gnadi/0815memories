/**
 * Encrypting the text of the moments written before it was encrypted.
 *
 * Until November 2026 a moment's caption, location, category and label went to
 * Firestore in clear (services/moments.js). Only a browser holds the family
 * key, so the old moments are encrypted in one: an admin's, the next time one
 * opens the app (components/admin/MomentTextEncryption.jsx). Viewers cannot
 * write moments, and a family no admin opens keeps its old moments as they
 * are until one does.
 *
 * Each moment is encrypted in a transaction that reads it again first, so an
 * edit made in the meantime is neither lost nor encrypted twice, and two
 * admins' browsers doing this at once cannot both write. Before anything is
 * written, every new value is decrypted again and compared with the original:
 * a key that cannot read back what it just wrote must not replace the only
 * readable copy. A run that stops halfway leaves nothing half done, since each
 * moment is either still in clear or encrypted with its mark, and the next run
 * finds the rest.
 */
import {
  collection,
  getCountFromServer,
  getDocs,
  query,
  runTransaction,
  where,
} from '../config/firestore'
import { db } from '../config/firebase'
import { decryptText } from '../utils/encryption'
import { devError } from '../utils/devLog'
import { encryptMomentText, MOMENT_TEXT_FIELDS } from './moments'

const MOMENTS = 'moments'

// The fields as stored on a moment from before, for encryptMomentText, which
// takes all four or none. A missing one stays missing: encryptFields leaves a
// value that is not a string as it is.
function textOf(data) {
  return Object.fromEntries(MOMENT_TEXT_FIELDS.map((field) => [field, data[field] ?? null]))
}

async function readsBack(key, original, encrypted) {
  for (const field of MOMENT_TEXT_FIELDS) {
    if (typeof original[field] !== 'string') continue
    if ((await decryptText(key, encrypted[field])) !== original[field]) return false
  }
  return true
}

async function encryptOne(database, key, ref) {
  return runTransaction(database, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) return false
    const data = snap.data()
    if (data.textEncrypted === true) return false
    const original = textOf(data)
    const encrypted = await encryptMomentText(key, original)
    if (!(await readsBack(key, original, encrypted))) {
      throw new Error('An encrypted moment did not decrypt to its text again')
    }
    // Only the text and the mark: the rest of the moment is left as it is.
    tx.update(ref, encrypted)
    return true
  })
}

/**
 * Does the family still have moments without the mark? Two counts, so a family
 * whose moments are all encrypted pays two reads per thousand moments, not one
 * read for each.
 */
async function hasMomentsInClear(database, familyId) {
  const family = query(collection(database, MOMENTS), where('familyId', '==', familyId))
  const marked = query(family, where('textEncrypted', '==', true))
  const [all, done] = await Promise.all([getCountFromServer(family), getCountFromServer(marked)])
  return done.data().count < all.data().count
}

/**
 * Encrypt every moment of the family that is still in clear. Needs the family
 * key and an admin, whom firestore.rules alone lets write moments. `database`
 * is for the rules tests, which run this against the emulator.
 *
 * @returns {Promise<{ encrypted: number, failed: number }>}
 */
export async function encryptFamilyMoments(familyId, key, { shouldStop = () => false, database = db } = {}) {
  const stats = { encrypted: 0, failed: 0 }
  if (!familyId || !key) return stats
  if (!(await hasMomentsInClear(database, familyId))) return stats

  const snap = await getDocs(query(collection(database, MOMENTS), where('familyId', '==', familyId)))
  for (const moment of snap.docs) {
    if (shouldStop()) break
    if (moment.data().textEncrypted === true) continue
    try {
      if (await encryptOne(database, key, moment.ref)) stats.encrypted++
    } catch (err) {
      // The moment stays as it was, readable; the next run tries again.
      stats.failed++
      devError('Could not encrypt the text of a moment', err)
    }
  }
  return stats
}
