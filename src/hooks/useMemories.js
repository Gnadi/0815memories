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

export function useMemories(familyId) {
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId || !db) {
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'memories'),
      where('familyId', '==', familyId),
      orderBy('date', 'desc')
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      setMemories(data)
      setLoading(false)
    })

    return unsubscribe
  }, [familyId])

  const addMemory = async (memory) => {
    await addDoc(collection(db, 'memories'), {
      ...memory,
      familyId,
      createdAt: serverTimestamp(),
    })
  }

  const updateMemory = async (id, updates) => {
    await updateDoc(doc(db, 'memories', id), updates)
  }

  const deleteMemory = async (id) => {
    await deleteDoc(doc(db, 'memories', id))
  }

  const featuredMemory = memories.find((m) => m.featured)

  return { memories, featuredMemory, loading, addMemory, updateMemory, deleteMemory }
}

export function useMoments(familyId) {
  const [moments, setMoments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId || !db) {
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'moments'),
      where('familyId', '==', familyId),
      orderBy('date', 'desc'),
      limit(10)
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      setMoments(data)
      setLoading(false)
    })

    return unsubscribe
  }, [familyId])

  const addMoment = async (moment) => {
    await addDoc(collection(db, 'moments'), {
      ...moment,
      familyId,
      date: serverTimestamp(),
    })
  }

  const deleteMoment = async (id) => {
    await deleteDoc(doc(db, 'moments', id))
  }

  return { moments, loading, addMoment, deleteMoment }
}
