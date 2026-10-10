/**
 * The Vault (the Black Box): letters to the children, sealed until a date.
 *
 * A capsule is two documents.
 *
 * `blackbox/{id}` holds the metadata the sealed card is built from — title,
 * trigger, unlock date — and admins can read it whenever. `blackboxContent/{id}`
 * holds the letter, and firestore.rules hands it to nobody before the date. The
 * seal is enforced by the database, not by isUnlocked() in hooks/useBlackBox.js.
 *
 * The split is forced by the query: `blackbox` is listed by familyId, and one
 * denied document fails a whole list listener, so the time condition cannot live
 * on the document the page lists.
 *
 * Capsules created before the split keep their payload inline on the metadata
 * document. Both eras are read here; services/blackboxMigration.js moves the old
 * ones across.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from '../config/firestore'
import { db } from '../config/firebase'
import { decryptFields, encryptFields } from '../utils/encryption'
import { devError } from '../utils/devLog'
import { subscribeDecrypted } from './decrypted'

const BLACKBOX = 'blackbox'
const BLACKBOX_CONTENT = 'blackboxContent'

// Encrypted on the metadata document. `message` appears here only on pre-split
// capsules — new ones carry it on the content document — but it must stay in
// this list until the migration has moved them all.
export const METADATA_ENCRYPTED_FIELDS = ['title', 'message']

// Encrypted on the content document.
export const CONTENT_ENCRYPTED_FIELDS = ['message']

/** The payload, which lives on the content document. */
function splitCapsule(box) {
  const { message, photos, videos, voiceNote, ...metadata } = box
  return {
    metadata,
    content: {
      message: message ?? '',
      photos: photos ?? [],
      videos: videos ?? [],
      voiceNote: voiceNote ?? null,
    },
  }
}

/** The family's capsules, newest first: their metadata, never their letters. */
export function subscribeBoxes(familyId, key, onData, onError) {
  return subscribeDecrypted(
    query(collection(db, BLACKBOX), where('familyId', '==', familyId), orderBy('createdAt', 'desc')),
    (docs) => Promise.all(docs.map((d) => decryptFields(key, d, METADATA_ENCRYPTED_FIELDS))),
    onData,
    onError,
  )
}

export async function addBox(familyId, key, box) {
  const { metadata, content } = splitCapsule(box)

  // warnMissing: the create page builds the whole document, so a field in the
  // list that isn't in the object means one of the two is wrong. That is the
  // exact mistake that kept these capsules in plaintext.
  const [encryptedMetadata, encryptedContent] = await Promise.all([
    encryptFields(key, metadata, ['title'], { warnMissing: true }),
    encryptFields(key, content, CONTENT_ENCRYPTED_FIELDS, { warnMissing: true }),
  ])

  // One batch, so a capsule never exists as metadata promising a letter that
  // was never written, or as an unreachable letter with no capsule.
  const ref = doc(collection(db, BLACKBOX))
  const batch = writeBatch(db)
  batch.set(ref, {
    ...encryptedMetadata,
    familyId,
    isSealed: true,
    sealedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  })
  batch.set(doc(db, BLACKBOX_CONTENT, ref.id), { ...encryptedContent, familyId })
  await batch.commit()
  return ref.id
}

/**
 * Read a capsule's letter. Returns null when the rules withheld it, which for
 * a sealed capsule is the expected answer rather than an error.
 *
 * Falls back to the inline fields of a pre-split capsule when no content
 * document exists.
 */
export async function getBoxContent(key, box) {
  try {
    const snap = await getDoc(doc(db, BLACKBOX_CONTENT, box.id))
    if (snap.exists()) {
      return decryptFields(key, snap.data(), CONTENT_ENCRYPTED_FIELDS)
    }
  } catch (err) {
    // A sealed capsule denies the read. Nothing to report — the caller shows
    // the sealed state, which is correct.
    devError('Black Box content read failed:', err)
    return null
  }
  // Pre-split capsule: the payload is on the metadata document, already
  // decrypted by the list.
  if (box.message != null || box.photos != null) {
    return {
      message: box.message ?? '',
      photos: box.photos ?? [],
      videos: box.videos ?? [],
      voiceNote: box.voiceNote ?? null,
    }
  }
  return null
}

/** Move a capsule's unlock date out to `until` — see checkIn in the hook. */
export async function setUnlockDate(id, until) {
  await updateDoc(doc(db, BLACKBOX, id), {
    unlockDate: Timestamp.fromDate(until),
    lastCheckInAt: serverTimestamp(),
  })
}

export async function updateBox(key, id, updates) {
  const encrypted = await encryptFields(key, updates, METADATA_ENCRYPTED_FIELDS)
  await updateDoc(doc(db, BLACKBOX, id), encrypted)
}

export async function deleteBox(id) {
  // Both halves, and the content first: a failure after this point leaves a
  // capsule with no letter, which the card handles. The reverse would leave an
  // orphaned letter no query would ever surface again.
  try {
    await deleteDoc(doc(db, BLACKBOX_CONTENT, id))
  } catch (err) {
    devError('Black Box content delete failed:', err)
  }
  await deleteDoc(doc(db, BLACKBOX, id))
}
