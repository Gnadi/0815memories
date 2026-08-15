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
import { db } from '../config/firebase'
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
async function decryptMemory(key, data) {
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
    const ref = await addDoc(collection(db, 'memories'), {
      ...encrypted,
      familyId,
      createdAt: serverTimestamp(),
    })
    // Fire-and-forget: write to notificationsQueue → Cloud Function sends the push
    addDoc(collection(db, 'notificationsQueue'), {
      familyId,
      title: 'New memory added',
      body: memory.title ? `"${memory.title}" was just shared.` : 'The family shared a new memory.',
      url: `/memory/${ref.id}`,
      createdAt: serverTimestamp(),
    }).catch(() => {})
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

export function useMoments(familyId, pageSize = DEFAULT_MOMENTS_LIMIT) {
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
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setMoments(data)
        setError(null)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [familyId, pageSize])

  const addMoment = async (moment) => {
    await addDoc(collection(db, 'moments'), {
      ...moment,
      familyId,
      date: serverTimestamp(),
    })
    // Fire-and-forget: write to notificationsQueue → Cloud Function sends the push
    addDoc(collection(db, 'notificationsQueue'), {
      familyId,
      title: 'New moment shared',
      body: moment.caption || 'A new moment was added to the feed.',
      url: '/',
      createdAt: serverTimestamp(),
    }).catch(() => {})
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

export function useAllMoments(familyId, pageSize = DEFAULT_ALL_MOMENTS_LIMIT) {
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
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setMoments(data)
        setError(null)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [familyId, pageSize])

  const updateMoment = async (id, updates) => {
    await updateDoc(doc(db, 'moments', id), updates)
  }

  const deleteMoment = async (id) => {
    await deleteDoc(doc(db, 'moments', id))
  }

  return { moments, loading, error, updateMoment, deleteMoment }
}
