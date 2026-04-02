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

export function useScrapbooks(familyId) {
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
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      setScrapbooks(data)
      setLoading(false)
    })

    return unsubscribe
  }, [familyId])

  const addScrapbook = async (data) => {
    const ref = await addDoc(collection(db, 'scrapbooks'), {
      ...data,
      familyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  }

  const updateScrapbook = async (id, data) => {
    await updateDoc(doc(db, 'scrapbooks', id), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }

  const deleteScrapbook = async (id) => {
    await deleteDoc(doc(db, 'scrapbooks', id))
  }

  return { scrapbooks, loading, addScrapbook, updateScrapbook, deleteScrapbook }
}
