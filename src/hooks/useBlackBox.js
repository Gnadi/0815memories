import { useState, useEffect, useCallback } from 'react'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
  writeBatch,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { encryptFields, decryptFields } from '../utils/encryption'
import { devError } from '../utils/devLog'

/**
 * A capsule is two documents.
 *
 * `blackbox/{id}` holds the metadata the sealed card is built from — title,
 * trigger, unlock date — and admins can read it whenever. `blackboxContent/{id}`
 * holds the letter, and firestore.rules hands it to nobody before the date. The
 * seal is enforced by the database, not by isUnlocked() below.
 *
 * The split is forced by the query: `blackbox` is listed by familyId, and one
 * denied document fails a whole list listener, so the time condition cannot live
 * on the document the page lists.
 *
 * Capsules created before the split keep their payload inline on the metadata
 * document. Both eras are read here; utils/blackboxMigration.js moves the old
 * ones across.
 */

// Encrypted on the metadata document. `message` appears here only on pre-split
// capsules — new ones carry it on the content document — but it must stay in
// this list until the migration has moved them all.
const METADATA_ENCRYPTED_FIELDS = ['title', 'message']

// Encrypted on the content document.
const CONTENT_ENCRYPTED_FIELDS = ['message']

// What a legacy capsule's first deadline is set to, and how far each check-in
// pushes it out. A year is long enough not to nag someone living their life, and
// short enough that a capsule reaches its family in good time.
export const LEGACY_GRACE_MONTHS = 12

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

/** `date` plus n months, clamped so 31 January + 1 month is not 3 March. */
export function addMonths(date, months) {
  const d = new Date(date)
  const targetDay = d.getDate()
  d.setMonth(d.getMonth() + months)
  if (d.getDate() < targetDay) d.setDate(0)
  return d
}

export function useBlackBox(familyId, encryptionKey) {
  const [boxes, setBoxes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId || !db) {
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'blackbox'),
      where('familyId', '==', familyId),
      orderBy('createdAt', 'desc')
    )
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        const decrypted = await Promise.all(
          docs.map((d) => decryptFields(encryptionKey, d, METADATA_ENCRYPTED_FIELDS))
        )
        setBoxes(decrypted)
        setLoading(false)
      },
      (err) => {
        if (import.meta.env.DEV) console.error('useBlackBox snapshot error:', err)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [familyId, encryptionKey])

  const addBox = async (box) => {
    const { metadata, content } = splitCapsule(box)

    // warnMissing: the create page builds the whole document, so a field in the
    // list that isn't in the object means one of the two is wrong. That is the
    // exact mistake that kept these capsules in plaintext.
    const [encryptedMetadata, encryptedContent] = await Promise.all([
      encryptFields(encryptionKey, metadata, ['title'], { warnMissing: true }),
      encryptFields(encryptionKey, content, CONTENT_ENCRYPTED_FIELDS, { warnMissing: true }),
    ])

    // One batch, so a capsule never exists as metadata promising a letter that
    // was never written, or as an unreachable letter with no capsule.
    const ref = doc(collection(db, 'blackbox'))
    const batch = writeBatch(db)
    batch.set(ref, {
      ...encryptedMetadata,
      familyId,
      isSealed: true,
      sealedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    })
    batch.set(doc(db, 'blackboxContent', ref.id), { ...encryptedContent, familyId })
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
  const fetchContent = useCallback(
    async (box) => {
      if (!db) return null
      try {
        const snap = await getDoc(doc(db, 'blackboxContent', box.id))
        if (snap.exists()) {
          return decryptFields(encryptionKey, snap.data(), CONTENT_ENCRYPTED_FIELDS)
        }
      } catch (err) {
        // A sealed capsule denies the read. Nothing to report — the caller shows
        // the sealed state, which is correct.
        devError('Black Box content read failed:', err)
        return null
      }
      // Pre-split capsule: the payload is on the metadata document, already
      // decrypted by the listener above.
      if (box.message != null || box.photos != null) {
        return {
          message: box.message ?? '',
          photos: box.photos ?? [],
          videos: box.videos ?? [],
          voiceNote: box.voiceNote ?? null,
        }
      }
      return null
    },
    [encryptionKey]
  )

  /**
   * Push a legacy capsule's deadline out by another grace window.
   *
   * This is the whole dead-man's switch: the capsule opens on its own unless
   * someone keeps moving the date. The rules only permit forward moves, so this
   * can be offered freely.
   */
  const checkIn = async (box, months = LEGACY_GRACE_MONTHS) => {
    const from = box.unlockDate?.toDate ? box.unlockDate.toDate() : new Date()
    // Measured from today when the deadline has already slipped into the past,
    // so a late check-in still buys a full window rather than a moment.
    const base = from > new Date() ? from : new Date()
    await updateDoc(doc(db, 'blackbox', box.id), {
      unlockDate: Timestamp.fromDate(addMonths(base, months)),
      lastCheckInAt: serverTimestamp(),
    })
  }

  const updateBox = async (id, updates) => {
    const encrypted = await encryptFields(encryptionKey, updates, METADATA_ENCRYPTED_FIELDS)
    await updateDoc(doc(db, 'blackbox', id), encrypted)
  }

  const deleteBox = async (id) => {
    // Both halves, and the content first: a failure after this point leaves a
    // capsule with no letter, which the card handles. The reverse would leave an
    // orphaned letter no query would ever surface again.
    try {
      await deleteDoc(doc(db, 'blackboxContent', id))
    } catch (err) {
      devError('Black Box content delete failed:', err)
    }
    await deleteDoc(doc(db, 'blackbox', id))
  }

  return { boxes, loading, addBox, updateBox, deleteBox, fetchContent, checkIn }
}

/**
 * Has this capsule opened?
 *
 * Presentation only — firestore.rules is what actually withholds the letter. A
 * legacy capsule needs no special case any more: it is a capsule whose date
 * keeps being pushed forward, so when the pushing stops, the date arrives.
 */
export function isUnlocked(box) {
  if (!box.unlockDate) return false
  const unlock = box.unlockDate.toDate ? box.unlockDate.toDate() : new Date(box.unlockDate)
  return unlock <= new Date()
}

/** Days until a capsule opens; negative once it has. */
export function daysUntilUnlock(box, now = new Date()) {
  if (!box.unlockDate) return null
  const unlock = box.unlockDate.toDate ? box.unlockDate.toDate() : new Date(box.unlockDate)
  return Math.ceil((unlock - now) / 86_400_000)
}
