import { useState, useEffect } from 'react'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  where,
  limit,
} from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import { encryptFields, decryptFields, decryptStringArray } from '../utils/encryption'
import { parseRichDoc } from '../utils/richText'

/**
 * Text fields every reader needs. The feed decrypts exactly these.
 */
export const MEMORY_TEXT_FIELDS = ['title', 'content', 'quote', 'location', 'authorName', 'category']

/**
 * What a write encrypts: the text fields plus `contentRich`, the rich
 * description document.
 *
 * `contentRich` is deliberately a JSON *string* by the time it reaches here, so
 * it rides the ordinary encryptFields() path. That matters: encryptFields skips
 * any value that is not a string, silently — an object would land in Firestore
 * as a readable map, and memories are `allow read: if true`. Keeping the field
 * on this list, as a string, means there is no second code path to forget.
 * firestore.rules rejects a non-string `contentRich` as a server-side backstop.
 */
export const MEMORY_WRITE_FIELDS = [...MEMORY_TEXT_FIELDS, 'contentRich']

/**
 * Feed decryption — text fields only.
 *
 * `contentRich` is left as ciphertext on purpose: this runs for up to 50
 * documents on every snapshot, no feed surface reads the rich document, and
 * readers fall back to the `content` plain-text mirror when it is not a parsed
 * document.
 */
export async function decryptMemory(key, data) {
  if (!key) return data
  const result = await decryptFields(key, data, MEMORY_TEXT_FIELDS)
  // The blur-up previews, which is the one thing here worth paying for on every
  // snapshot: ~700 bytes each, measured at 0.19ms, so fifty of them cost about
  // 10ms and replace fifty spinners with the photos' own colours. They are the
  // reason this decrypt happens at all — there is nothing to fetch.
  if (Array.isArray(result.thumbsTiny)) {
    result.thumbsTiny = await decryptStringArray(key, result.thumbsTiny)
  }
  return result
}

/**
 * Single-document read (detail page, edit form, export): decrypt everything and
 * parse the rich description. Idempotent, so passing an already-decrypted
 * memory back through is harmless.
 */
export async function decryptMemoryDoc(key, data) {
  if (!key) return data
  const result = await decryptFields(key, data, MEMORY_WRITE_FIELDS)
  if (result.contentRich != null) result.contentRich = parseRichDoc(result.contentRich)
  return result
}

/**
 * The single encryption entry point for writes. Every memory write in the app
 * goes through useMemoryWriter, which goes through here.
 */
export async function encryptMemoryData(key, data) {
  // Fail loudly rather than write a readable map. encryptFields would skip a
  // non-string silently, and nothing downstream would look broken.
  if (data?.contentRich != null && typeof data.contentRich !== 'string') {
    throw new Error('contentRich must be a JSON string before encryption')
  }
  if (!key) return data
  return encryptFields(key, data, MEMORY_WRITE_FIELDS)
}

const DEFAULT_MEMORIES_LIMIT = 50
const DEFAULT_MOMENTS_LIMIT = 10

/**
 * Write operations only — no Firestore subscription.
 *
 * Components that just need a "create memory" action (the global admin bottom
 * nav, for one) used to call useMemories() for it, which opened a second
 * 50-document listener and re-decrypted six fields per memory on every
 * snapshot, in parallel with the page's own listener.
 */
export function useMemoryWriter(familyId, encryptionKey) {
  const addMemory = async (memory) => {
    const encrypted = await encryptMemoryData(encryptionKey, memory)
    await addDoc(collection(db, 'memories'), {
      ...encrypted,
      familyId,
      // Plaintext on purpose, and the only new field here: notifyOnMemory uses
      // it to leave the author's own device alone. The push itself is composed
      // server-side now — the title above is ciphertext by this point, and
      // sending it would have undone the encryption for anyone reading the
      // lock screen.
      createdByUid: auth?.currentUser?.uid || null,
      createdAt: serverTimestamp(),
    })
  }

  const updateMemory = async (id, updates) => {
    const encrypted = await encryptMemoryData(encryptionKey, updates)
    await updateDoc(doc(db, 'memories', id), encrypted)
  }

  const deleteMemory = async (id) => {
    await deleteDoc(doc(db, 'memories', id))
  }

  return { addMemory, updateMemory, deleteMemory }
}

export function useMemories(familyId, encryptionKey, pageSize = DEFAULT_MEMORIES_LIMIT) {
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!familyId || !db) {
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'memories'),
      where('familyId', '==', familyId),
      orderBy('date', 'desc'),
      limit(pageSize)
    )
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        const decrypted = await Promise.all(docs.map((d) => decryptMemory(encryptionKey, d)))
        setMemories(decrypted)
        setError(null)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [familyId, encryptionKey, pageSize])

  const writer = useMemoryWriter(familyId, encryptionKey)

  const featuredMemory = memories.find((m) => m.featured)

  return { memories, featuredMemory, loading, error, ...writer }
}

/**
 * Moments keep their text in clear: caption, category, location and label are
 * not encrypted, and utils/nasExport.js says so in a line of its own.
 *
 * `thumbsTiny` is the exception, and it went unnoticed because it is not
 * written here. The shared upload path (utils/encryptedUpload.js) and the
 * shared thumbnail backfill (utils/thumbnailMigration.js) both encrypt it for
 * moments exactly as they do for memories. Nothing decrypted it again, so every
 * moment card handed ~1 KB of ciphertext to an `<img src>`: no blur-up, and a
 * relative-URL request per card.
 *
 * The same field, the same call, the same reasoning as decryptMemory above —
 * ~700 bytes each, and it replaces a spinner with the photo's own colours.
 */
async function decryptMoment(key, data) {
  if (!key || !Array.isArray(data.thumbsTiny)) return data
  return { ...data, thumbsTiny: await decryptStringArray(key, data.thumbsTiny) }
}

/**
 * The moments subscription, shared by the home row and the full grid — they
 * differ only in how many documents they ask for.
 */
function useMomentsSubscription(familyId, encryptionKey, pageSize) {
  const [moments, setMoments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!familyId || !db) {
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'moments'),
      where('familyId', '==', familyId),
      orderBy('date', 'desc'),
      limit(pageSize)
    )

    // Snapshots resolve asynchronously now, so a later one can finish before an
    // earlier one — a re-emit whose previews are all memoised beats a cold first
    // load every time. Only the newest answer is allowed to land.
    let cancelled = false
    let latest = 0

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const seq = ++latest
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        const decrypted = await Promise.all(docs.map((d) => decryptMoment(encryptionKey, d)))
        if (cancelled || seq !== latest) return
        setMoments(decrypted)
        setError(null)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [familyId, encryptionKey, pageSize])

  return { moments, loading, error }
}

export function useMoments(familyId, encryptionKey, pageSize = DEFAULT_MOMENTS_LIMIT) {
  const { moments, loading, error } = useMomentsSubscription(familyId, encryptionKey, pageSize)

  const addMoment = async (moment) => {
    await addDoc(collection(db, 'moments'), {
      ...moment,
      familyId,
      createdByUid: auth?.currentUser?.uid || null,
      date: serverTimestamp(),
    })
  }

  const updateMoment = async (id, updates) => {
    await updateDoc(doc(db, 'moments', id), updates)
  }

  const deleteMoment = async (id) => {
    await deleteDoc(doc(db, 'moments', id))
  }

  return { moments, loading, error, addMoment, updateMoment, deleteMoment }
}

const DEFAULT_ALL_MOMENTS_LIMIT = 200

export function useAllMoments(familyId, encryptionKey, pageSize = DEFAULT_ALL_MOMENTS_LIMIT) {
  const { moments, loading, error } = useMomentsSubscription(familyId, encryptionKey, pageSize)

  const updateMoment = async (id, updates) => {
    await updateDoc(doc(db, 'moments', id), updates)
  }

  const deleteMoment = async (id) => {
    await deleteDoc(doc(db, 'moments', id))
  }

  return { moments, loading, error, updateMoment, deleteMoment }
}
