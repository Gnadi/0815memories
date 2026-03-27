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

export function useMemories() {
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'memories'), orderBy('date', 'desc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      setMemories(data)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const addMemory = async (memory) => {
    await addDoc(collection(db, 'memories'), {
      ...memory,
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

export function useMoments() {
  const [moments, setMoments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'moments'), orderBy('date', 'desc'), limit(10))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      setMoments(data)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const addMoment = async (moment) => {
    await addDoc(collection(db, 'moments'), {
      ...moment,
      date: serverTimestamp(),
    })
  }

  return { moments, loading, addMoment }
}
