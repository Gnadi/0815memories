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

// A highlight video document stores the *recipe* — shot list, durations, title
// card, theme — not the rendered file. The reel is re-rendered on demand from
// photos the family already has, which keeps these documents tiny and avoids
// pushing a video through Cloudinary's 10 MB raw-asset cap.
async function encryptHighlight(key, data) {
  if (!key) return data
  const result = { ...data }
  if (result.title != null) result.title = await encryptText(key, result.title)
  if (result.doc != null) result.doc = await encryptJSON(key, result.doc)
  return result
}

async function decryptHighlight(key, data, { withDoc = true } = {}) {
  if (!key) return data
  const result = { ...data }
  if (typeof result.title === 'string') result.title = await decryptText(key, result.title)
  if (withDoc && typeof result.doc === 'string') {
    result.doc = await decryptJSON(key, result.doc)
  }
  return result
}

export { decryptHighlight }

export function useHighlightWriter(familyId, encryptionKey) {
  const addHighlight = async (data) => {
    const encrypted = await encryptHighlight(encryptionKey, data)
    const ref = await addDoc(collection(db, 'highlights'), {
      ...encrypted,
      familyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  }

  const updateHighlight = async (id, data) => {
    const encrypted = await encryptHighlight(encryptionKey, data)
    await updateDoc(doc(db, 'highlights', id), {
      ...encrypted,
      updatedAt: serverTimestamp(),
    })
  }

  const deleteHighlight = async (id) => {
    await deleteDoc(doc(db, 'highlights', id))
  }

  return { addHighlight, updateHighlight, deleteHighlight }
}

/**
 * Live list of the family's highlight videos, newest first.
 */
export function useHighlights(familyId, encryptionKey, { withDoc = false } = {}) {
  const [highlights, setHighlights] = useState([])
  // Which family the current list belongs to. Tracking it (rather than a
  // `loading` flag flipped inside the effect) means no synchronous setState in
  // an effect body, and a family switch still reads as "loading" until its own
  // first snapshot lands.
  const [loadedFor, setLoadedFor] = useState(null)

  useEffect(() => {
    if (!familyId || !db) return

    const q = query(
      collection(db, 'highlights'),
      where('familyId', '==', familyId),
      orderBy('createdAt', 'desc')
    )
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      const decrypted = await Promise.all(
        docs.map((d) => decryptHighlight(encryptionKey, d, { withDoc }))
      )
      setHighlights(decrypted)
      setLoadedFor(familyId)
    }, (error) => {
      if (import.meta.env.DEV) console.error('Failed to load highlights:', error)
      setLoadedFor(familyId)
    })

    return unsubscribe
  }, [familyId, encryptionKey, withDoc])

  const writer = useHighlightWriter(familyId, encryptionKey)
  const loading = !!familyId && !!db && loadedFor !== familyId

  return { highlights, loading, ...writer }
}
