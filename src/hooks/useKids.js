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

export function useKids(familyId) {
  const [kids, setKids] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId || !db) {
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'children'),
      where('familyId', '==', familyId),
      orderBy('createdAt', 'asc')
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      setKids(data)
      setLoading(false)
    })

    return unsubscribe
  }, [familyId])

  const addKid = async (kid) => {
    await addDoc(collection(db, 'children'), {
      ...kid,
      familyId,
      createdAt: serverTimestamp(),
    })
  }

  const updateKid = async (id, updates) => {
    await updateDoc(doc(db, 'children', id), updates)
  }

  const deleteKid = async (id) => {
    await deleteDoc(doc(db, 'children', id))
  }

  return { kids, loading, addKid, updateKid, deleteKid }
}
