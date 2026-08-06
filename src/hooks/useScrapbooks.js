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
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { encryptText, decryptText, encryptJSON, decryptJSON } from '../utils/encryption'

async function encryptScrapbook(key, data) {
  if (!key) return data
  const result = { ...data }
  if (result.title != null) result.title = await encryptText(key, result.title)
  if (result.pages != null) result.pages = await encryptJSON(key, result.pages)
  return result
}

async function decryptScrapbook(key, data, { withPages = true } = {}) {
  if (!key) return data
  const result = { ...data }
  if (result.title != null && typeof result.title === 'string') result.title = await decryptText(key, result.title)
  // `pages` holds every element of every page of the whole book. Decrypting and
  // JSON-parsing it for a list that only shows a title and a cover is the most
  // expensive thing this hook could do, so callers have to ask for it.
  if (withPages && result.pages != null && typeof result.pages === 'string') {
    result.pages = await decryptJSON(key, result.pages)
  }
  return result
}

/**
 * Write operations only — no Firestore subscription. See useMemoryWriter for
 * why this is split out.
 */
export function useScrapbookWriter(familyId, encryptionKey) {
  const addScrapbook = async (data) => {
    const encrypted = await encryptScrapbook(encryptionKey, data)
    const ref = await addDoc(collection(db, 'scrapbooks'), {
      ...encrypted,
      familyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  }

  const updateScrapbook = async (id, data) => {
    const encrypted = await encryptScrapbook(encryptionKey, data)
    await updateDoc(doc(db, 'scrapbooks', id), {
      ...encrypted,
      updatedAt: serverTimestamp(),
    })
  }

  const deleteScrapbook = async (id) => {
    await deleteDoc(doc(db, 'scrapbooks', id))
  }

  return { addScrapbook, updateScrapbook, deleteScrapbook }
}

/**
 * Live list of the family's scrapbooks. `pages` stays encrypted unless asked
 * for — the overview only needs `title` and `coverImageUrl`, and the editor
 * loads its one book itself.
 */
export function useScrapbooks(familyId, encryptionKey, { withPages = false } = {}) {
  const [scrapbooks, setScrapbooks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId || !db) {
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'scrapbooks'),
      where('familyId', '==', familyId),
      orderBy('createdAt', 'desc')
    )
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      const decrypted = await Promise.all(
        docs.map((d) => decryptScrapbook(encryptionKey, d, { withPages }))
      )
      setScrapbooks(decrypted)
      setLoading(false)
    }, (error) => {
      if (import.meta.env.DEV) console.error('Failed to load scrapbooks:', error)
      setLoading(false)
    })

    return unsubscribe
  }, [familyId, encryptionKey, withPages])

  const writer = useScrapbookWriter(familyId, encryptionKey)

  return { scrapbooks, loading, ...writer }
}
