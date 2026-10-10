/**
 * Files to delete for good, for what is deleted without going through the
 * trash: an Our Year chapter, whose keepsake photo is in an encrypted field
 * that only its two partners can read. The trash would show the chapter to
 * every admin.
 *
 * The purgeTrash function deletes each file once it has made sure it is this
 * family's, and firestore.rules lets nobody read the requests back.
 */
import { addDoc, collection, serverTimestamp } from '../config/firestore'
import { auth, db } from '../config/firebase'
import { mediaIn } from '../utils/mediaUrls'

// firestore.rules takes up to this many files per request.
const MAX_PER_REQUEST = 50

/** Asks for the Cloudinary files in `decrypted`, a decrypted document, to go. */
export async function requestMediaDeletion(familyId, decrypted) {
  const media = [...mediaIn(decrypted)]
  for (let i = 0; i < media.length; i += MAX_PER_REQUEST) {
    await addDoc(collection(db, 'mediaDeletions'), {
      familyId,
      media: media.slice(i, i + MAX_PER_REQUEST),
      requestedAt: serverTimestamp(),
      requestedBy: auth?.currentUser?.uid ?? null,
    })
  }
}
