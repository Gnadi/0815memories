/**
 * The devices registered for push.
 *
 * `fcmTokens/{id}` holds one device's token, named by the token's hash so the
 * same device always lands on the same document. firestore.rules lets a family
 * member write theirs and nobody read any: only the Cloud Functions that send
 * the notifications do. So nothing here ever queries the collection.
 */
import { deleteDoc, doc, serverTimestamp, setDoc } from '../config/firestore'
import { db } from '../config/firebase'

const FCM_TOKENS = 'fcmTokens'

export async function saveDeviceToken(id, { familyId, token, lang, uid }) {
  await setDoc(
    doc(db, FCM_TOKENS, id),
    { familyId, token, lang, uid, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

export async function removeDeviceToken(id) {
  await deleteDoc(doc(db, FCM_TOKENS, id))
}
