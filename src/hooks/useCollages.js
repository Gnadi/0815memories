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

// `doc` holds the whole collage — template id, styling and every slot's photo
// URL. Encrypted as one JSON blob, exactly like a scrapbook's `pages`.
async function encryptCollage(key, data) {
  if (!key) return data
  const result = { ...data }
  if (result.title != null) result.title = await encryptText(key, result.title)
  if (result.doc != null) result.doc = await encryptJSON(key, result.doc)
  return result
}

async function decryptCollage(key, data, { withDoc = true } = {}) {
  if (!key) return data
  const result = { ...data }
  if (typeof result.title === 'string') result.title = await decryptText(key, result.title)
  // Opt-in, same reasoning as useScrapbooks: a caller that only lists titles
  // should not JSON-parse every collage's slot list on every snapshot. The
  // gallery does ask for it — it re-draws each collage from the document
  // instead of storing a rendered cover image.
  if (withDoc && typeof result.doc === 'string') {
    result.doc = await decryptJSON(key, result.doc)
  }
  return result
}

export { decryptCollage }

/**
 * Write operations only — no Firestore subscription. The editor loads its one
 * collage itself, so subscribing there would live-decrypt every other collage.
 */
export function useCollageWriter(familyId, encryptionKey) {
  const addCollage = async (data) => {
    const encrypted = await encryptCollage(encryptionKey, data)
    const ref = await addDoc(collection(db, 'collages'), {
      ...encrypted,
      familyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  }

  const updateCollage = async (id, data) => {
    const encrypted = await encryptCollage(encryptionKey, data)
    await updateDoc(doc(db, 'collages', id), {
      ...encrypted,
      updatedAt: serverTimestamp(),
    })
  }

  const deleteCollage = async (id) => {
    await deleteDoc(doc(db, 'collages', id))
  }

  return { addCollage, updateCollage, deleteCollage }
}

/**
 * Live list of the family's collages, newest first.
 */
export function useCollages(familyId, encryptionKey, { withDoc = false } = {}) {
  const [collages, setCollages] = useState([])
  // Which family the current list belongs to. Tracking it (rather than a
  // `loading` flag flipped inside the effect) means no synchronous setState in
  // an effect body, and a family switch still reads as "loading" until its own
  // first snapshot lands.
  const [loadedFor, setLoadedFor] = useState(null)

  useEffect(() => {
    if (!familyId || !db) return

    const q = query(
      collection(db, 'collages'),
      where('familyId', '==', familyId),
      orderBy('createdAt', 'desc')
    )
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      const decrypted = await Promise.all(
        docs.map((d) => decryptCollage(encryptionKey, d, { withDoc }))
      )
      setCollages(decrypted)
      setLoadedFor(familyId)
    }, (error) => {
      if (import.meta.env.DEV) console.error('Failed to load collages:', error)
      setLoadedFor(familyId)
    })

    return unsubscribe
  }, [familyId, encryptionKey, withDoc])

  const writer = useCollageWriter(familyId, encryptionKey)
  const loading = !!familyId && !!db && loadedFor !== familyId

  return { collages, loading, ...writer }
}
